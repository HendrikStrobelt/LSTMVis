import argparse
import json

import os

import numpy as np
import yaml
from flask import Flask, send_from_directory, jsonify, Response, redirect
from flask import request
from flask_cors import CORS

from lstmdata.data_handler import LSTMDataHandler
import lstmdata.read_index as ri
import lstmdata.helper_functions as hf

CONFIG_FILE_NAME = 'lstm.yml'

__author__ = 'Hendrik Strobelt'

app = Flask(__name__)
CORS(app)

data_handlers = {}
index_map = {}


@app.route('/')
def hello_world():
    """
    :return: "hello world"
    """
    return redirect('client/index.html')


@app.route('/api/rle_states/<int:pos>')
def rle_states(pos):
    left = int(request.args.get("left", 10))
    right = int(request.args.get("right", 10))
    data_transform = request.args.get("data_transform", 'tanh')
    threshold = float(request.args.get("threshold", .3))
    data_set = request.args.get("data_set")
    source = request.args.get("source")
    rle = int(request.args.get('rle', 3))

    dh = data_handlers[data_set]  # type: LSTMDataHandler

    if not source:
        source = dh.config['states']['types'][0]['path']

    res = dh.get_states([pos], source,
                        left=left,
                        right=right,
                        data_transform=data_transform,
                        activation_threshold=threshold,
                        transpose=True, rle=rle)

    return Response(json.dumps(res), mimetype='application/json')


@app.route('/api/states/<int:pos>')
def get_states(pos):
    """
    :param pos: the index position
    :return: all states for the given position and positions left and right
    """

    data_set = request.args.get("data_set")
    source = request.args.get("source")
    left = int(request.args.get("left", 10))
    right = int(request.args.get("right", 10))
    data_transform = request.args.get("data_transform", 'tanh')
    # rle = request.args.get('rle', False)

    dh = data_handlers[data_set]  # type: LSTMDataHandler

    if not source:
        source = dh.config['states']['types'][0]['path']

    res = dh.get_states([pos], source,
                        left=left,
                        right=right,
                        data_transform=data_transform)

    json_res = json.dumps(res)

    return Response(json_res, mimetype='application/json')


@app.route('/api/context/')
def get_context():
    pos_string = str(request.args.get("pos", ''))
    data_set = request.args.get("data_set")
    source = request.args.get("source")
    left = int(request.args.get("left", 10))
    right = int(request.args.get("right", 10))
    threshold = float(request.args.get('threshold', .6))
    data_transform = request.args.get("data_transform", 'tanh')
    bit_mask = request.args.get('bitmask', '')
    cell_string = request.args.get('cells', '')
    rle = int(request.args.get('rle', 0))
    if len(bit_mask) > 0:
        cells = np.where(np.fromstring(bit_mask, dtype=np.uint8) > 48)[0].tolist()
    elif len(cell_string) > 0:
        cells = map(lambda x: int(x), cell_string.split(','))
    else:
        cells = []

    dimension_string = str(request.args.get("dimensions", 'states'))

    pos_array = map(lambda x: int(x), pos_string.split(','))
    dimensions = dimension_string.split(',')

    dh = data_handlers[data_set]  # type: LSTMDataHandler

    if not source:
        source = dh.config['states']['types'][0]['path']

    res = dh.get_dimensions(pos_array, source,
                            left=left,
                            right=right,
                            dimensions=dimensions,
                            data_transform=data_transform,
                            cells=cells,
                            activation_threshold=threshold,
                            rle=rle)

    res['pos'] = pos_array
    res['data_set'] = data_set
    res['source'] = source
    res['left'] = left
    res['right'] = right
    res['data_transform'] = data_transform
    res['dimensions'] = dimensions
    res['cells'] = cells
    res['threshold'] = threshold

    json_res = json.dumps(res)

    return Response(json_res, mimetype='application/json')


@app.route('/api/closest_sequences/')
def closest_sequence():
    options = request.args
    data_set = request.args.get("data_set")
    source = request.args.get("source")
    cell_string = options.get('cells', '')
    cells = map(lambda x: int(x), cell_string.split(','))
    threshold = float(options.get('threshold', .3))
    data_transform = request.args.get("data_transform", 'tanh')
    phrase_length = int(options.get('phrase_length', 0))
    sort_mode = options.get('sort_mode', 'cells')
    query_mode = options.get('query_mode', 'fast')
    constrain_left = True if (int(options.get('constrain_left', 0)) == 1) else False
    constrain_right = True if (int(options.get('constrain_right', 0)) == 1) else False

    dh = data_handlers[data_set]  # type: LSTMDataHandler

    if not source:
        source = dh.config['states']['types'][0]['path']

    indices, meta = dh.query_similar_activations(cells, source,
                                                 activation_threshold=threshold,
                                                 data_transform=data_transform,
                                                 add_histograms=True,
                                                 phrase_length=phrase_length,
                                                 sort_mode=sort_mode,
                                                 query_mode=query_mode,
                                                 constrain_left=constrain_left,
                                                 constrain_right=constrain_right)

    res = {
        'sort_mode': sort_mode,
        'threshold': threshold,
        'source': source,
        'data_transform': data_transform,
        'cells': cells,
        'dataset': data_set,
        'data': indices,
        'fuzzy_length_histogram': meta['fuzzy_length_histogram'].tolist(),
        'strict_length_histogram': meta['strict_length_histogram'].tolist()
    }

    return Response(json.dumps(res), mimetype='application/json')


@app.route('/api/info/')
def info():
    res = []
    for key, value in data_handlers.iteritems():
        res.append({
            'project': key,
            'info': value.config
        })

    res = sorted(res, key=lambda x: x['project'])
    return Response(json.dumps(res), mimetype='application/json')


@app.route('/api/search_words/')
def search_words():
    """ Defines API ``/api/search_words`` to access search index

    :'limit=': number of results
    :'query=': the query string
    :'html=': should the call return html formatted results
    :'data_set=': data set ID
    :return: list({'index': ..., 'text': ... }...) see :func:`lstmdata.read_index.query_index`
    """
    options = request.args
    limit = float(options.get('limit', 100))
    query = options.get('query', "---")
    html = options.get('html', False)
    data_set = request.args.get("data_set")
    res = []
    data_set_key = data_set

    dh = data_handlers[data_set_key]
    if dh.config['etc']['regex_search']:
        res = dh.regex_search(query, limit, html)
    elif data_set_key in index_map:
        res = ri.query_index(query, limit, html, dir=index_map[data_set_key])

    return json.dumps(res)


# send everything from client as static content
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


parser = argparse.ArgumentParser()
parser.add_argument("--nodebug", default=False)
parser.add_argument("--port", default="8888")
parser.add_argument("--nocache", default=False)
parser.add_argument("-dir", type=str, default=os.path.abspath('data'))

if __name__ == '__main__':
    args = parser.parse_args()
    create_data_handlers(args.dir)

    print args

    app.run(port=int(args.port), debug=not args.nodebug, host="0.0.0.0")
else:
    # args = parser.parse_args()
    create_data_handlers(".")

    # create_data_handlers("data")
    # app.run(debug=False)
