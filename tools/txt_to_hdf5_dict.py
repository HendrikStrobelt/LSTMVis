#!/usr/bin/env python

"""
Takes a .txt file with the source data for the trained model and
creates the sparse word indices as well as a dictionary that maps
the word indices to the actual words. 
To transform into validation and test with the same dictionary, 
use model/preprocess.py

Usage: python txt_to_hdf5_dict.py INPUT.txt OUTPUTNAME

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

    def write(self, outfile):
        out = open(outfile, "w")
        items = [(v, k) for k, v in self.d.iteritems()]
        items.sort()
        for v, k in items:
            print >>out, k, v
        out.close()
        
def get_data(args):
    target_indexer = Indexer()
    # add special words to indices in the target_indexer
    target_indexer.convert("<s>")
    target_indexer.convert("<unk>")
    target_indexer.convert("</s>")
    
    words = []
    wordschar = []
    targets = []
    for i, targ_orig in enumerate(args.targetfile):
        targ_orig = targ_orig.replace("<eos>", "")
        targ = targ_orig.strip().split() + ["</s>"]
        #here put something for shifting window
        target_sent = [target_indexer.convert(w) for w in targ]
        words += target_sent
    
    words = numpy.array(words, dtype=int)

    # plus 1 for the next word
    targ_output = numpy.array(words[1:] + [target_indexer.convert("</s>")])
    original_index = numpy.array([i+1 for i, v in enumerate(words)], dtype=int)

    print (words.shape, "shape of the word array before preprocessing")
    
    # Write output.
    f = h5py.File(args.outputfile + ".hdf5", "w")
    f["target"] = words
    f["indices"] = original_index
    f["target_output"] = targ_output
    f["target_size"] = numpy.array([target_indexer.counter])
    f["set_size"] = words.shape[0]

    target_indexer.write(args.outputfile + ".targ.dict")
    
def main(arguments):
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('targetfile', help="Target Input file", 
                        type=argparse.FileType('r'))
    parser.add_argument('outputfile', help="Output file name", 
                        type=str)
    args = parser.parse_args(arguments)
    get_data(args)

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
