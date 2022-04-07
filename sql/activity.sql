SELECT datname as db, pid, usesysid, usename, application_name as app_name,
  client_addr, client_port as port, backend_start,
  xact_start, query_start, state_change, wait_event, state, backend_xid, backend_xmin, query
FROM pg_stat_activity
WHERE application_name <> 'psql'
;
