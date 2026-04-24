
export const baseEmailTemplate = (title: string, contentHtml: string) => {
  const currentYear = new Date().getFullYear();
  
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
            background-color: #f6f9fc;
        }
        .wrapper {
            width: 100%;
            table-layout: fixed;
            background-color: #f6f9fc;
            padding-bottom: 40px;
        }
        .container {
            max-width: 600px; 
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            margin-top: 40px;
            box-shadow: 0 4px 6px rgba(50, 50, 93, 0.11), 0 1px 3px rgba(0, 0, 0, 0.08);
            overflow: hidden;
        }
        .header {
            background-color: #0066cc;
            padding: 40px 20px;
            text-align: center;
        }
        .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 26px;
            font-weight: 700;
            letter-spacing: -0.5px;
        }
        .content {
            padding: 40px 30px;
        }
        .content h2, .content h3 {
            font-size: 20px;
            margin-top: 0;
            color: #1a1a1a;
        }
        .footer {
            padding: 30px;
            text-align: center;
            font-size: 13px;
            color: #8898aa;
            background-color: #fcfcfc;
            border-top: 1px solid #eeeeee;
        }
        .button {
            display: inline-block;
            padding: 14px 30px;
            background-color: #0066cc;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
            text-align: center;
        }
        .info-box {
            background-color: #f8fafd;
            padding: 20px;
            border-left: 4px solid #0066cc;
            margin: 25px 0;
            border-radius: 4px;
        }
        .warning-box {
            background-color: #fffcf0;
            padding: 20px;
            border-left: 4px solid #f2c94c;
            margin: 25px 0;
            border-radius: 4px;
        }
        .divider {
            height: 1px;
            background-color: #e6ebf1;
            margin: 30px 0;
        }
        .pricing-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        .pricing-table th {
            text-align: left;
            padding: 12px;
            border-bottom: 1px solid #e6ebf1;
            color: #8898aa;
            font-size: 12px;
            text-transform: uppercase;
        }
        .pricing-table td {
            padding: 12px;
            border-bottom: 1px solid #e6ebf1;
        }
        .total-row {
            background-color: #f8fafd;
            font-weight: bold;
        }
        @media only screen and (max-width: 600px) {
            .container {
                margin-top: 0;
                border-radius: 0;
            }
            .content {
                padding: 30px 20px;
            }
        }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <div class="header">
                <h1>${title}</h1>
            </div>
            <div class="content">
                ${contentHtml}
            </div>
            <div class="footer">
                <p>&copy; ${currentYear} <strong>Port2Port</strong>. All rights reserved.</p>
                <p>Ensuring your vehicles move across ports with ease and reliability.</p>
                <p style="margin-top: 10px; font-size: 11px;">This is an automated message, please do not reply to this email.</p>
            </div>
        </div>
    </div>
</body>
</html>
  `;
};
