import type { VercelRequest, VercelResponse } from '@vercel/node';

interface StartRequest {
  action: 'start';
  invoke_url: string;
  personal_access_token: string;
  inputs?: Record<string, string | number | boolean | null | undefined>;
}

interface PollRequest {
  action: 'poll';
  poll_url: string;
  personal_access_token: string;
}

type JobRequest = StartRequest | PollRequest;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body as JobRequest;

    if (body.action === 'start') {
      if (!body.invoke_url || !body.personal_access_token) {
        return res.status(400).json({ error: 'UiPath API Trigger not configured. Please set up Invoke URL and Personal Access Token in Admin settings.' });
      }

      // Append inputs as query string parameters (UiPath API Trigger reads
      // GET inputs from the URL query string and binds them to workflow args).
      let invokeUrl = body.invoke_url;
      if (body.inputs && Object.keys(body.inputs).length > 0) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(body.inputs)) {
          if (value === undefined || value === null) continue;
          params.set(key, String(value));
        }
        const qs = params.toString();
        if (qs) {
          invokeUrl = body.invoke_url.includes('?')
            ? `${body.invoke_url}&${qs}`
            : `${body.invoke_url}?${qs}`;
        }
      }

      // Start the job via GET — use redirect: "manual" so we can capture 303 + Location
      const response = await fetch(invokeUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${body.personal_access_token}`,
        },
        redirect: 'manual',
      });

      if (response.status === 200 || response.status === 201) {
        // Job completed immediately
        const output = await response.json();
        return res.status(200).json({ success: true, completed: true, output });
      }

      if (response.status === 202) {
        // Job started, poll the Location URL for status
        const pollUrl = response.headers.get('Location');
        return res.status(200).json({ success: true, completed: false, pollUrl });
      }

      // Handle redirects (3xx) — extract Location to poll
      if (response.status >= 300 && response.status < 400) {
        const pollUrl = response.headers.get('Location');
        if (pollUrl) {
          return res.status(200).json({ success: true, completed: false, pollUrl });
        }
      }

      const errText = await response.text();
      throw new Error(`UiPath API Trigger failed (${response.status}): ${errText}`);
    }

    if (body.action === 'poll') {
      if (!body.poll_url || !body.personal_access_token) {
        return res.status(400).json({ error: 'Poll URL and token are required.' });
      }

      // Check job status — use redirect: "manual" to capture further 202s
      const response = await fetch(body.poll_url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${body.personal_access_token}`,
        },
        redirect: 'manual',
      });

      if (response.status === 200) {
        // Job completed
        const output = await response.json();
        return res.status(200).json({ success: true, completed: true, output });
      }

      if (response.status === 202) {
        // Still running — may return a new Location URL
        const newPollUrl = response.headers.get('Location');
        return res.status(200).json({ success: true, completed: false, pollUrl: newPollUrl || body.poll_url });
      }

      // Handle redirects
      if (response.status >= 300 && response.status < 400) {
        const newPollUrl = response.headers.get('Location');
        if (newPollUrl) {
          return res.status(200).json({ success: true, completed: false, pollUrl: newPollUrl });
        }
      }

      const errText = await response.text();
      throw new Error(`UiPath poll failed (${response.status}): ${errText}`);
    }

    return res.status(400).json({ error: 'Invalid action. Use "start" or "poll".' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('UiPath API Trigger error:', message);
    return res.status(500).json({ error: message });
  }
}
