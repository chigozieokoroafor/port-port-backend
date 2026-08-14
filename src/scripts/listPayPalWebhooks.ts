import dotenv from 'dotenv';
dotenv.config();

import logger from '../utils/logger';

/**
 * List the webhook subscriptions already registered on this PayPal app, printing each
 * one's id, URL, and subscribed event types.
 *
 * Why this exists: PayPal's dashboard buries webhook management inside the app detail
 * page (Apps & Credentials -> your app -> Sandbox Webhooks), which is easy to miss. But
 * if PayPal is already delivering events to your endpoint, a subscription already exists
 * — you just need its id for PAYPAL_WEBHOOK_ID. This reads it straight from PayPal's REST
 * API using the same client credentials the app uses, so there's no dashboard hunting.
 *
 * It's read-only: it creates nothing and changes nothing. Sandbox vs Live is chosen by
 * NODE_ENV, exactly like the runtime client.
 *
 * Run:  npm run paypal:webhooks
 */

const baseUrl =
    process.env.NODE_ENV === 'production'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';

const getAccessToken = async (): Promise<string> => {
    const id = process.env.PAYPAL_CLIENT_ID;
    const secret = process.env.PAYPAL_CLIENT_SECRET;
    if (!id || !secret) {
        throw new Error('PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set in .env');
    }

    const basic = Buffer.from(`${id}:${secret}`).toString('base64');
    const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${basic}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    });

    if (!res.ok) {
        throw new Error(`PayPal OAuth token request failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) throw new Error('PayPal OAuth token missing from response');
    return data.access_token;
};

interface PayPalWebhook {
    id: string;
    url: string;
    event_types?: { name: string }[];
}

const listWebhooks = async () => {
    try {
        const token = await getAccessToken();

        const res = await fetch(`${baseUrl}/v1/notifications/webhooks`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!res.ok) {
            throw new Error(`List webhooks failed: ${res.status} ${await res.text()}`);
        }

        const data = (await res.json()) as { webhooks?: PayPalWebhook[] };
        const webhooks = data.webhooks ?? [];

        logger.info(`PayPal environment: ${baseUrl}`);
        if (webhooks.length === 0) {
            logger.warn('No webhooks registered on this app. Create one (URL -> <BACKEND_URL>/paypal/webhook)');
            logger.warn('either in the dashboard (Apps & Credentials -> your app -> Sandbox Webhooks) or');
            logger.warn('by adding a create script. Nothing will verify until one exists.');
            process.exit(0);
        }

        logger.info(`Found ${webhooks.length} webhook(s):`);
        for (const w of webhooks) {
            const events = (w.event_types ?? []).map((e) => e.name);
            logger.info('--------------------------------------------------');
            logger.info(`  id:     ${w.id}     <-- copy this into PAYPAL_WEBHOOK_ID`);
            logger.info(`  url:    ${w.url}`);
            logger.info(`  events: ${events.length ? events.join(', ') : '(none)'}`);
        }
        logger.info('--------------------------------------------------');
        logger.info('Set PAYPAL_WEBHOOK_ID to the id whose url matches your current BACKEND_URL, then restart.');
        process.exit(0);
    } catch (error) {
        logger.error('Error listing PayPal webhooks:', error);
        process.exit(1);
    }
};

listWebhooks();
