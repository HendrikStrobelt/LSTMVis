import argparse
import connexion
import os
import yaml
from flask import send_from_directory

from lstmdata.data_handler import LSTMDataHandler

__author__ = 'Hendrik Strobelt'

CONFIG_FILE_NAME = 'lstm.yml'
data_handlers = {}
index_map = {}

app = connexion.App(__name__, debug=False)


def get_context(**query):
    project = query['project']
    if project not in data_handlers:
        return 'No such project', 404
    else:
        return {'query': query}


def get_info():
    print 'getinfo'
    print data_handlers
    res = []
    for key, value in data_handlers.iteritems():
        print key
        res.append({
            'project': key,
            'info': value.config
        })
    return sorted(res, key=lambda x: x['project'])


def search(**query):
    project = query['project']
    if project not in data_handlers:
        return 'No such project', 404
    else:

        return {'query': query}


@app.route('/client/<path:path>')
def send_static(path):
    """ serves all files from ./client/ to ``/client/<path:path>``

    :param path: path from api call
    """
    return send_from_directory('client/', path)


def create_data_handlers(directory):
    """
    searches for CONFIG_FILE_NAME in all subdirectories of directory
    and creates data handlers for all of them

    :param directory: scan directory
    :return: null
    """
    project_dirs = []
    for root, dirs, files in os.walk(directory):
        if CONFIG_FILE_NAME in files:
            project_dirs.append(os.path.abspath(root))

    i = 0
    for p_dir in project_dirs:
        with open(os.path.join(p_dir, CONFIG_FILE_NAME), 'r') as yf:
            config = yaml.load(yf)
            dh_id = os.path.split(p_dir)[1]
            data_handlers[dh_id] = LSTMDataHandler(directory=p_dir, config=config)
            if data_handlers[dh_id].config['index']:
                index_map[dh_id] = data_handlers[dh_id].config['index_dir']
        i += 1


app.add_api('lstm_server.yaml')

parser = argparse.ArgumentParser()
parser.add_argument("--nodebug", default=False)
parser.add_argument("--port", default="8888")
parser.add_argument("--nocache", default=False)
parser.add_argument("-dir", type=str, default=os.path.abspath('data'))

args = parser.parse_args()
create_data_handlers(args.dir)

if __name__ == '__main__':
    app.run(port=int(args.port),
            debug=not args.nodebug, host="0.0.0.0")
