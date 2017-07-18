from optparse import OptionParser

import logging
import numpy as np

import h5py

__author__ = 'Hendrik Strobelt'


def stat_info(file, path):
    arr = h5py.File(file)[path][:]
    print('shape', arr.shape)
    print('min', arr.min())
    print('max', arr.max())
    print('mean', arr.mean())
    print('std', np.std(arr))
    print('median', np.median(arr))

def main():
    parser = OptionParser(usage='%prog <h5_file> <path>\nGives some stats for h5 tables.')

    (options, args) = parser.parse_args()
    logging.basicConfig(format='%(asctime)s %(levelname)s \t %(message)s', level=logging.INFO)
    if len(args) != 2:
        parser.print_help()
    else:
        stat_info(args[0], args[1])


if __name__ == '__main__':
    main()
