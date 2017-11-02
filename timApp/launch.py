import multiprocessing
import os
import signal
import subprocess
import sys

import timApp.tim
from timApp.initdb2 import initialize_database, initialize_temp_database
from timApp.logger import log_info
from timApp.tim_app import app
from timApp.utils import pycharm_running


# noinspection PyUnusedLocal
def quit_fast(sig, frame):
    sys.exit(0)


if __name__ == '__main__':
    # quit faster when running in PyCharm
    if pycharm_running():
        signal.signal(signal.SIGINT, quit_fast)
    initialize_database()
    initialize_temp_database()
    try:
        os.remove(app.config['GLOBAL_NOTIFICATION_FILE'])
    except FileNotFoundError:
        pass
    if len(sys.argv) <= 1:
        log_info('Starting without gunicorn.')
        timApp.tim.start_app()
    elif sys.argv[1] == '--with-gunicorn':
        log_info(f'Starting with gunicorn. CPUs available: {multiprocessing.cpu_count()}')
        p = subprocess.Popen(["gunicorn", "-p", "/var/run/gunicorn.pid", "--config", "gunicornconf.py", "tim:init_app()"])
        p.wait()
    else:
        raise Exception('Unknown command line argument: ' + sys.argv[1])
