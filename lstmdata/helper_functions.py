import difflib

import numpy as np

__author__ = 'Hendrik Strobelt'


def align_forward(s1, s2, reverse_results=True):
    """

    :return: information about changes in s2 (typ) and the aligned s2(aligned)
    :param reverse_results: True if the the alignment information should be reversed
    :param s2: array of ``State`` entries in alignment order
    :param s1: array of ``State`` entries in alignment order
    :rtype: list, list
    """
    length = len(s1)
    s = difflib.SequenceMatcher(None, s2, s1)
    aligned = ["_"] * (length + 2)
    typ = [-1] * (length + 2)

    for op, a_start, a_end, b_start, b_end in s.get_opcodes():
        if op == "equal":
            aligned[a_start:a_end] = [w.word for w in s2[b_start:b_end]]
            typ[a_start:a_end] = [w for w in range(b_start, b_end)]

        elif op == "replace":
            aligned[a_start] = "|" + "_".join([w.word for w in s2[b_start:b_end]])
            typ[a_start] = -999

        elif op == "insert":
            # doesn't seem to get called
            pass

        elif op == "delete":
            # doesn't seem to get called
            pass

    if reverse_results:
        aligned.reverse()
        typ.reverse()

        typ_reverse = range(0, len(typ))
        for i, d in enumerate(typ):
            if d > -1:
                typ_reverse[i] = length - d - 1
            else:
                typ_reverse[i] = d

        typ = typ_reverse

    order = []
    # Check where there are alignments.
    for i in range(len(aligned)):
        # Cut-off long words
        if len(aligned[i]) > 7:
            aligned[i] = aligned[i][:7]
        if aligned[i][0] == "|":
            # Drop leading words.
            if not order:
                aligned[i] = "_"
        elif aligned[i][0] == "_":
            continue
        else:
            order.append(i)

    diff_order = 0
    if len(order) > 0:
        diff_order = min(order)

    return typ, aligned, diff_order


def cos_matrix_multiplication(matrix, vector, matrix_norms=None):
    """Calculating pairwise cosine distance using matrix vector multiplication.

    :param matrix: matrix
    :param vector: vector
    :param matrix_norms: pre-computed matrix norms
    """
    # print matrix.shape
    # print vector.shape

    if not matrix_norms:
        matrix_norms = np.linalg.norm(matrix, axis=1)

    dotted = matrix.dot(vector)

    vector_norm = np.linalg.norm(vector)
    matrix_vector_norms = np.multiply(matrix_norms, vector_norm)
    neighbors = np.divide(dotted, matrix_vector_norms)
    return neighbors


def rle(inarray):
    """ run length encoding. Partial credit to R rle function.
        Multi datatype arrays catered for including non Numpy

        :returns: tuple (runlengths, startpositions, values) """
    ia = np.array(inarray)  # force numpy
    n = len(ia)
    if n == 0:
        return None, None, None
    else:
        y = np.array(ia[1:] != ia[:-1])  # pairwise unequal (string safe)
        i = np.append(np.where(y), n - 1)  # must include last element posi
        z = np.diff(np.append(-1, i))  # run lengths
        p = np.cumsum(np.append(0, z))[:-1]  # positions
        return z, p, ia[i]


def threshold_discrete(arr, threshold, below, above):
    """
    thresholds an np.array and assigns new values for below and above/equal
    :param arr: --
    :param threshold: --
    :param below: value assigned if under threshold
    :param above: value assigned if above threshold
    :return:
    """

    all_below_positions = arr < threshold
    arr[:] = above
    arr[all_below_positions] = below
