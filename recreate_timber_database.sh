#!/bin/bash
docker run --rm -v /opt/tim/:/service -t -i tim:$(./get_latest_date.sh) /bin/bash -c 'cd /service/timApp/tim_files && python3 ../sql/recreate_timber_database.py'