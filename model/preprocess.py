#!/usr/bin/env python

"""
Create the input data for the LSTM.

Usage: python preprocess.py TRAIN.txt TEST.txt batch seqlength outputfile
"""

import os
import sys
import argparse
import numpy
import h5py
import itertools

__author__ = 'Sebastian Gehrmann'


class Indexer:
    def __init__(self):
        self.counter = 1
        self.d = {}
        self.rev = {}
        self._lock = False
        
    def convert(self, w):
        if w not in self.d:
            if self._lock:
                return self.d["<unk>"]
            self.d[w] = self.counter
            self.rev[self.counter] = w
            self.counter += 1
        return self.d[w]

    def lock(self):
        self._lock = True

    def write(self, outfile):
        out = open(outfile, "w")
        items = [(v, k) for k, v in self.d.iteritems()]
        items.sort()
        for v, k in items:
            print >>out, k, v
        out.close()
        
def get_data(args):
    target_indexer = Indexer()
    #add special words to indices in the target_indexer
    target_indexer.convert("<s>")
    target_indexer.convert("<unk>")
    target_indexer.convert("</s>")
    
    def convert(targetfile, batchsize, seqlength, outfile):
        words = []
        wordschar = []
        targets = []
        for i, targ_orig in enumerate(targetfile):
            targ_orig = targ_orig.replace("<eos>", "")
            targ = targ_orig.strip().split() + ["</s>"]
            #here put something for shifting window
            target_sent = [target_indexer.convert(w) for w in targ]
            words += target_sent

        # plus 1 for torch.
        targ_output = numpy.array(words[1:] + [target_indexer.convert("</s>")])
        words = numpy.array(words)
        print (words.shape, "shape of the word array before preprocessing")
        # Write output.
        f = h5py.File(outfile, "w")
        size = words.shape[0] / (batchsize * seqlength)
        print (size, "number of blocks after conversion")

        original_index = numpy.array([i+1 for i, v in enumerate(words)])
        
        f["target"] = numpy.zeros((size, batchsize, seqlength), dtype=int)
        f["indices"] = numpy.zeros((size, batchsize, seqlength), dtype=int) 
        f["target_output"] = numpy.zeros((size, batchsize, seqlength), dtype=int) 
        pos = 0
        for row in range(batchsize):
            for batch in range(size):
                f["target"][batch, row] = words[pos:pos+seqlength]
                f["indices"][batch, row] = original_index[pos:pos+seqlength]
                f["target_output"][batch, row] = targ_output[pos:pos+seqlength]
                pos = pos + seqlength
        f["target_size"] = numpy.array([target_indexer.counter])

        f["words"] = words
        f["set_size"] = words.shape[0]

    convert(args.targetfile, args.batchsize, args.seqlength, args.outputfile + ".hdf5")
    target_indexer.lock()
    convert(args.targetvalfile, args.batchsize, args.seqlength, args.outputfile + "-val" + ".hdf5")
    target_indexer.write(args.outputfile + ".dict")
    
def main(arguments):
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('targetfile', help="Target Input file", 
                        type=argparse.FileType('r'))
    parser.add_argument('targetvalfile', help="Target Input file", 
                        type=argparse.FileType('r'))

    parser.add_argument('batchsize', help="Batchsize", 
                        type=int)
    parser.add_argument('seqlength', help="Sequence length", 
                        type=int)
    parser.add_argument('outputfile', help="HDF5 output file", 
                        type=str)
    args = parser.parse_args(arguments)
    get_data(args)

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
