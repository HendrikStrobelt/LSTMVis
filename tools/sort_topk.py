from optparse import OptionParser

import h5py
import logging
import os
import numpy as np

__author__ = 'Hendrik Strobelt'


def convert(inFileName, op):
    inFile = h5py.File(inFileName)
    filename, file_extension = os.path.splitext(inFileName)
    outFileName = filename + '_sorted' + file_extension
    outFile = h5py.File(outFileName, 'w')

    indices = inFile[op.indices][:]
    scores = inFile[op.scores][:]

    out_indidces = outFile.create_dataset("indices", indices.shape)
    out_scores = outFile.create_dataset("scores", scores.shape)

    length = min(indices.shape[0], scores.shape[0])

    for i in range(0, length):
        merged = np.dstack([indices[i], scores[i]])[0]
        sorted_vec = merged[merged[:, 1].argsort()][::-1]
        out_indidces[i] = sorted_vec[:, 0]
        out_scores[i] = sorted_vec[:, 1]
        if i % 10000 == 0:
            print i
    outFile.close()


def main():
    parser = OptionParser(usage='%prog [options] <topK_file.h5> \n'
                                'Sorts TopK Files')

    parser.add_option('-i', help="indices table path", type=str, default="indices", dest='indices')
    parser.add_option('-s', help="scores table path", type=str, default="scores", dest='scores')

    (options, args) = parser.parse_args()
    logging.basicConfig(format='%(asctime)s %(levelname)s \t %(message)s', level=logging.INFO)

    if len(args) != 1:
        parser.print_help()
    else:

        convert(args[0], options)


if __name__ == '__main__':
    main()
