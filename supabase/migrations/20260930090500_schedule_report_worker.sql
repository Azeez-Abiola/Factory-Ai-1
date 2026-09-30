-- Runs the scheduled-report worker hourly so due report_schedules (and their
-- Resend emails) actually fire, instead of only running when someone opens
-- Scheduled reports and clicks "Run now".
-- pg_cron / pg_net are enabled by earlier migrations.

-- Idempotent: drop any previous job with this name before recreating it.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'run-report-schedules-hourly';

SELECT cron.schedule(
  'run-report-schedules-hourly',
  '5 * * * *', -- 5 minutes past every hour (UTC)
  $$
  SELECT net.http_post(
    url := 'https://eoutyszocyqnaqufjufi.supabase.co/functions/v1/run-report-schedules',
    headers := '{
      "Content-Type": "application/json",
      "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdXR5c3pvY3lxbmFxdWZqdWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzNzMxNjEsImV4cCI6MjEwNDk0OTE2MX0.uV3AwUgKLN9sWiX343_njYPiowWuUQOPJFUeP8ixJVQ",
      "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdXR5c3pvY3lxbmFxdWZqdWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzNzMxNjEsImV4cCI6MjEwNDk0OTE2MX0.uV3AwUgKLN9sWiX343_njYPiowWuUQOPJFUeP8ixJVQ"
    }'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
