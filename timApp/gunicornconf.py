import os
import sys
# Without this, the timdb import will fail
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import multiprocessing

from timdb import timdb2

bind = "0.0.0.0:5000"
workers = multiprocessing.cpu_count() * 2 + 1  # Recommended value is cpu_count() * 2 + 1
worker_class = "gevent"  # Possible values: sync, gevent, eventlet, tornado, gaiohttp, gthread
limit_request_line = 0
timeout = 600


def pre_request(worker, req):
    timdb2.worker_pid = worker.pid
