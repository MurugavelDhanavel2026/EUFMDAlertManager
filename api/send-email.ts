import type { VercelRequest, VercelResponse } from '@vercel/node';

interface GraphApiConfig {
  tenant_id: string;
  app_id: string;
  client_secret: string;
  sender_email: string;
}

interface EmailRequest {
  to: string;
  subject: string;
  body: string;
  graphConfig: GraphApiConfig;
}

async function getAccessToken(config: GraphApiConfig): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${config.tenant_id}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: config.app_id,
    client_secret: config.client_secret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token request failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function sendEmailViaGraph(
  accessToken: string,
  senderEmail: string,
  to: string,
  subject: string,
  htmlBody: string
): Promise<void> {
  const sendUrl = `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`;

  const message = {
    message: {
      subject,
      body: {
        contentType: 'HTML',
        content: htmlBody,
      },
      toRecipients: to.split(',').map((email) => ({
        emailAddress: { address: email.trim() },
      })),
    },
    saveToSentItems: true,
  };

  const res = await fetch(sendUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Send email failed (${res.status}): ${err}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, subject, body, graphConfig } = req.body as EmailRequest;

    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, body' });
    }

    if (!graphConfig?.tenant_id || !graphConfig?.app_id || !graphConfig?.client_secret || !graphConfig?.sender_email) {
      return res.status(400).json({ error: 'Graph API not configured. Please set up Tenant ID, App ID, Client Secret, and Sender Email in Admin settings.' });
    }

    const accessToken = await getAccessToken(graphConfig);
    await sendEmailViaGraph(accessToken, graphConfig.sender_email, to, subject, body);

    return res.status(200).json({ success: true, message: 'Email sent successfully' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Send email error:', message);
    return res.status(500).json({ error: message });
  }
}
