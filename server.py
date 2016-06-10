import argparse
import json

import os

import numpy as np
import yaml
from flask import Flask, send_from_directory, jsonify, Response
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
    name = request.args.get("name")
    # print h.heap()

    if name:
        return 'Hello, ' + name
    else:
        return 'Hello World!'


@app.route('/api/rle_states/<int:pos>')
def rle_states(pos):
    left = int(request.args.get("left", 10))
    right = int(request.args.get("right", 10))
    data_transform = request.args.get("data_transform", 'tanh')
    threshold = float(request.args.get("threshold", .3))
    data_set = int(request.args.get("data_set", 0))
    source = request.args.get("source")
    rle = int(request.args.get('rle', 3))

    dh = data_handlers[data_handlers.keys()[data_set]]  # type: LSTMDataHandler

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

    data_set = int(request.args.get("data_set", 0))
    source = request.args.get("source")
    left = int(request.args.get("left", 10))
    right = int(request.args.get("right", 10))
    data_transform = request.args.get("data_transform", 'tanh')
    # rle = request.args.get('rle', False)

    dh = data_handlers[data_handlers.keys()[data_set]]  # type: LSTMDataHandler

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
    data_set = int(request.args.get("data_set", 0))
    source = request.args.get("source")
    left = int(request.args.get("left", 10))
    right = int(request.args.get("right", 10))
    embedding_threshold = float(request.args.get('embedding_threshold', .6))
    state_threshold = float(request.args.get('state_threshold', .6))
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

    dh = data_handlers[data_handlers.keys()[data_set]]  # type: LSTMDataHandler

    if not source:
        source = dh.config['states']['types'][0]['path']

    res = dh.get_dimensions(pos_array, source,
                            left=left,
                            right=right,
                            dimensions=dimensions,
                            embedding_threshold=embedding_threshold,
                            state_threshold=state_threshold,
                            data_transform=data_transform,
                            cells=cells,
                            activation_threshold=threshold,
                            rle=rle)

    res['pos'] = pos_array
    res['data_set'] = data_set
    res['source'] = source
    res['left'] = left
    res['right'] = right
    res['embedding_threshold'] = embedding_threshold
    res['state_threshold'] = state_threshold
    res['data_transform'] = data_transform
    res['dimensions'] = dimensions
    res['cells'] = cells
    res['threshold'] = threshold

    json_res = json.dumps(res)

    return Response(json_res, mimetype='application/json')


@app.route('/api/closest_sequences/')
def closest_sequence():
    options = request.args
    data_set = int(request.args.get("data_set", 0))
    source = request.args.get("source")
    cell_string = options.get('cells', '')
    cells = map(lambda x: int(x), cell_string.split(','))
    threshold = float(options.get('threshold', .3))
    data_transform = request.args.get("data_transform", 'tanh')
    phrase_length = int(options.get('phrase_length', 0))
    sort_mode = options.get('sort_mode', 'cells')

    dh = data_handlers[data_handlers.keys()[data_set]]  # type: LSTMDataHandler

    if not source:
        source = dh.config['states']['types'][0]['path']

    indices, meta = dh.get_closest_sequences_2(cells, source,
                                               activation_threshold=threshold,
                                               data_transform=data_transform,
                                               add_histograms=True,
                                               phrase_length=phrase_length,
                                               sort_mode=sort_mode)

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


@app.route('/api/cell_info/')
def cell_info():
    options = request.args
    data_set = int(request.args.get("data_set", 0))
    source = request.args.get("source")
    cell_string = options.get('cells', '')
    cells = map(lambda x: int(x), cell_string.split(','))
    data_transform = request.args.get("data_transform", 'tanh')
    threshold = float(options.get('threshold', 0.3))
    min_pass = int(options.get('min_pass', 100))
    add_words = options.get('add_words', False)

    dh = data_handlers[data_handlers.keys()[data_set]]  # type: LSTMDataHandler

    if not source:
        source = dh.config['states']['types'][0]['path']

    data = dh.get_rle(cells, source,
                      data_transform=data_transform,
                      threshold=threshold,
                      min_pass=min_pass,
                      add_words=add_words
                      )

    res = {
        'threshold': threshold,
        'min_pass': min_pass,
        'source': source,
        'data_transform': data_transform,
        'cells': cells,
        'dataset': data_set,
        'add_words': add_words,
        'rle': data
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
    data_set = int(request.args.get("data_set", 0))
    res = []
    data_set_key = data_handlers.keys()[data_set]
    if data_set_key in index_map:
        res = ri.query_index(query, limit, html, dir=index_map[data_set_key])

    return json.dumps(res)


@app.route('/api/embedding/')
def api_embedding():
    data_set = int(request.args.get("data_set", 0))
    query = request.args.get('query', "")
    sort_result = request.args.get('sort', False)

    dh = data_handlers[data_handlers.keys()[data_set]]  # type: LSTMDataHandler

    res, mean = dh.get_embedding_for_string(query, sort_results=sort_result)

    return Response(json.dumps({'query': query, 'data_set': data_set, 'res': res, 'mean': mean}),
                    mimetype='application/json')


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
            data_handlers[p_dir] = LSTMDataHandler(directory=p_dir, config=config)
            if data_handlers[p_dir].config['index']:
                index_map[p_dir] = data_handlers[p_dir].config['index_dir']
        i += 1

parser = argparse.ArgumentParser()
parser.add_argument("--nodebug", default=False)
parser.add_argument("--port", default="8888")
parser.add_argument("--nocache", default=False)
parser.add_argument("-dir", type=str, default=os.path.abspath('data'))

if  __name__ == '__main__':
    args = parser.parse_args()
    create_data_handlers(args.dir)


    print args

    app.run(port=int(args.port), debug=not args.nodebug, host="0.0.0.0")
else:
    create_data_handlers("data")
    #app.run(debug=False)
