#! /usr/bin/env python
import logging

import h5py as h5
from optparse import OptionParser

__author__ = 'Hendrik Strobelt'

MAX_ROWS = 100000


def convert(in_file, out_file):
    data_in = h5.File(in_file, 'r')
    data_out = h5.File(out_file, 'w')
    for k in data_in.keys():
        if "offset"  in k: continue
        logging.info('processing table: %s', k)

        slice_offset = 0
        shape = data_in[k].shape
        print shape
        x_out = data_out.create_dataset(k, (shape[0], shape[1] * 2))
        while slice_offset < shape[0]:
            slice_end = min(slice_offset + MAX_ROWS, shape[0])
            pos_in = data_in[k][slice_offset:slice_end, :]
            pos_in[pos_in < 0] = 0
            x_out[slice_offset:slice_end, : pos_in.shape[1]] = pos_in
            neg_in = -data_in[k][slice_offset:slice_end, :]
            neg_in[neg_in < 0] = 0
            x_out[slice_offset:slice_end, pos_in.shape[1]:pos_in.shape[1] * 2] = neg_in

            slice_offset = slice_end
            logging.info('slice: %i', slice_offset)

    logging.info('done. Remember to add the "unsigned:true" attribute to your lstm.yml file.')


def main():
    parser = OptionParser(usage='%prog [options] <input_hdf5_file> <output_hdf5_file>\n'
                                'Converts all tables in an HDF5 file into an unsigned format for LSTMVis.')

    (options, args) = parser.parse_args()
    logging.basicConfig(format='%(asctime)s %(levelname)s \t %(message)s', level=logging.INFO)

    if len(args) != 2:
        parser.print_help()
    else:

        convert(args[0], args[1])


if __name__ == '__main__':
    main()
