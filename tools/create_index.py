#! /usr/bin/env python
from optparse import OptionParser

import h5py
import yaml
from whoosh.index import create_in, os
from whoosh.fields import *
from whoosh.analysis import *
import logging

__author__ = 'Hendrik Strobelt'

CONFIG_FILE_NAME = 'lstm.yml'


def configuration(project_dir):
    """
    checks, if dir and config file exist. if so, returns it as python dict.
    :param project_dir:
    :return: config dictionary
    """
    if not os.path.isdir(project_dir):
        logging.error('%s is not a dir', project_dir)
        return

    config_file_name = os.path.join(project_dir, CONFIG_FILE_NAME)
    if not os.path.isfile(config_file_name):
        logging.error('no config file found: %s', config_file_name)
        return

    # else:

    # config = {}
    try:
        with open(config_file_name, 'r') as cf:
            res = yaml.load(cf)
    except IOError:
        logging.error('cannot read config file')
        sys.exit(-1)
    return res


def dictionary(project_dir, config):
    """
    loads the word dictionary file
    :param project_dir:
    :param config:
    :return: id2word dictionary
    """
    id2word = {}
    dict_file_name = os.path.join(project_dir, config['files'][config['word_sequence']['dict_file']])
    try:
        with open(dict_file_name, 'r') as df:
            for line in df:
                if len(line.split()) == 2:
                    k, v = line.split()
                elif line[0] == " ":
                    k = " "
                    v = line.strip()
                try:
                    id2word[int(v)] = unicode(k, 'utf-8')
                except UnicodeError:
                    logging.error('unicode error in: %s', line)
                    break
    except IOError:
        logging.error('cannot read dict file %s', dict_file_name)
        sys.exit(-1)
    return id2word


def sequence_data(project_dir, config):
    """
    opens word sequence HDF5 file
    :param project_dir:
    :param config:
    :return: pointer to word sequence array
    """
    try:
        h5_seq = h5py.File(os.path.join(project_dir, config['files'][config['word_sequence']['file']]))
    except IOError:
        logging.error('cannot open HDF5 file %s', config['files'][config['word_sequence']['file']])
        sys.exit(-1)
    res = h5_seq[config['word_sequence']['path']]
    return res


def index_project(project_dir, options):
    config = configuration(project_dir)

    id2word = dictionary(project_dir=project_dir, config=config)

    sequence = sequence_data(project_dir=project_dir, config=config)

    my_analyzer = SpaceSeparatedTokenizer() | LowercaseFilter()

    schema = Schema(index=NUMERIC(stored=True),
                    content=TEXT(stored=True, analyzer=my_analyzer))

    # create new dir if it doesn't exist yet
    index_dir_path = os.path.join(project_dir, 'indexdir')
    if not os.path.exists(index_dir_path):
        os.mkdir(index_dir_path)

    # create index
    ix = create_in(index_dir_path, schema)
    writer = ix.writer(limitmb=1024, procs=4)  # uses up to 4GB of RAM
    logging.info('starting indexing')
    for i in range(7, len(sequence)):
        tokens = map(lambda x: id2word[x], sequence[i - 7:i])
        tokens.insert(2, '||')
        a = u" ".join(tokens)
        writer.add_document(index=(i - 5),
                            content=a)
        if i % 10000 == 0:
            logging.info('pos: %i, string: %s', i, a)

    logging.info(' writing index...')
    writer.commit()
    logging.info(' .. done.')


def main():
    parser = OptionParser(usage='%prog [options] <project_directory>\nCreates an search index for LSTMVis.')

    (options, args) = parser.parse_args()
    logging.basicConfig(format='%(asctime)s %(levelname)s \t %(message)s', level=logging.INFO)
    if len(args) != 1:
        parser.print_help()
    else:
        index_project(args[0], options)


if __name__ == '__main__':
    main()
