import os

import gc
import h5py
import resource

import numpy as np
import re
import scipy.signal

import helper_functions as hf
from data_structures import State

__author__ = 'Hendrik Strobelt'


class LSTMDataHandler:
    def __init__(self, directory, config):
        """LSTM data handler

        :param directory: base directory for lstm project
        :param config: configuration (YAML file content)
        :rtype: None
        """
        self.config = config

        # storage for h5 references and all dicts
        self.h5_files = {}
        self.dicts_value_id = {}
        self.dicts_id_value = {}

        # open all h5 files
        h5files = {k: v for k, v in config['files'].iteritems() if v.endswith('.h5')}
        for key, file_name in h5files.iteritems():
            self.h5_files[key] = h5py.File(os.path.join(directory, file_name), 'r')

        # load all dict files of format: value<space>id
        dict_files = {k: v for k, v in config['files'].iteritems() if v.endswith('.dict')}
        for name, file_name in dict_files.iteritems():
            kv = {}
            vk = {}
            with open(os.path.join(directory, file_name), 'r') as f:
                for line in f:
                    if len(line) > 0:
                        k, v = line.split()
                        kv[k] = int(v)
                        vk[int(v)] = k
                self.dicts_value_id[name] = kv
                self.dicts_id_value[name] = vk

        # for caching the matrices
        self.cached_matrix = {}
        self.current = {}

        # enrich config with sizes
        default_state_file = self.config['states']['file']
        for x in self.config['states']['types']:
            x['file'] = x.get('file', default_state_file)
            x['unsigned'] = x.get('unsigned', False)
            x['transform'] = x.get('transform', 'tanh')
            cell_states, _ = self.get_cached_matrix(x['transform'], x['file'] + '::' + x['path'])
            x['size'] = list(cell_states.shape)

        ws = self.config['word_sequence']
        self.config['word_sequence']['size'] = list(self.h5_files[ws['file']][ws['path']].shape)
        self.config['word_sequence']['dict_size'] = len(self.dicts_id_value[ws['dict_file']])

        if 'word_embedding' in self.config:
            we = self.config['word_embedding']
            self.config['word_embedding']['size'] = list(self.h5_files[we['file']][we['path']].shape)
        else:
            self.config['word_embedding'] = {'size': [-1, -1]}

        # enrich meta section with proper ranges
        self.config['index'] = os.path.isdir(os.path.join(directory, 'indexdir'))
        if self.config['index']:
            self.config['index_dir'] = os.path.join(directory, 'indexdir')

        if self.config['meta']:
            for _, m_info in self.config['meta'].iteritems():
                vis_range = m_info['vis']['range']
                if vis_range == 'dict':
                    m_info['vis']['range'] = self.dicts_value_id[m_info['dict']].keys()
                elif type(vis_range) is str:
                    m = re.search("([0-9]+)\.\.\.([0-9]+)", vis_range)
                    if m:
                        m_info['vis']['range'] = range(int(m.group(1)), int(m.group(2)))
        else:
            self.config['meta'] = []

            # print 'init cs:', '{:,}'.format(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)

    def get_embedding_ref(self):
        we = self.config['word_embedding']
        return self.h5_files[we['file']][we['path']]

    def get_embedding_for_string(self, word, sort_results=False):
        we = self.config['word_embedding']
        dictionary = self.dicts_value_id[self.config['word_sequence']['dict_file']]
        emb = self.h5_files[we['file']][we['path']]
        if 'mean_embedding' not in self.current:
            self.current['mean_embedding'] = np.median(emb, axis=0)
        res = np.array([])
        if word in dictionary:
            res = emb[dictionary[word], :]

        if sort_results:
            args = np.argsort(self.current['mean_embedding'])
            if res.shape[0] > 0:
                return res[args].tolist(), self.current['mean_embedding'][args].tolist()
            else:
                return [], self.current['mean_embedding'][args].tolist()
        else:
            return res.tolist(), self.current['mean_embedding'].tolist()

    def get_states(self, pos_array, source, left=10, right=0, cell_selection=None, raw=False, round_values=5,
                   data_transform='tanh', activation_threshold=0.3, add_active_cells=False, transpose=False, rle=0):

        """Get information about states.

        :param pos_array: array of positions
        :param source: source path in states.h5 file
        :param left: positions to the left
        :param right: positions to the right
        :param cell_selection: selection of cells (None if all cells)
        :param raw: deliver the states submatrix as numpy array (default:false)
        :param round_values: if not raw then round to round_values digits
        :param data_transform: data transformation (default: tanh) -- options: raw, tanh, tanhabs
        :param activation_threshold: activation threshold for when a cell is considered to be active(default: 0.3)
        :param add_active_cells: add active cell count for each position (False)
        :param transpose: transpose states sub-matrix and active cell matrix (False)
        :return: [ ...{left: position left, right: position right, pos: requestes pos, data: states matrix},...],[sum_active]
        :rtype: (list, list)
        """

        if cell_selection is None:
            cell_selection = []

        cell_states, data_transformed = self.get_cached_matrix(data_transform, source)
        # cell_states = self.h5_files[self.config['states']['file']][source]

        res = []
        sum_active = []
        for pos in pos_array:
            left_pos = pos - min(left, pos)
            right_pos = min(len(cell_states), pos + 1 + right)

            if len(cell_selection) == 0:
                cs = cell_states[left_pos:right_pos]
            else:
                cs = cell_states[left_pos:right_pos, cell_selection]

            if not data_transformed:
                if data_transform == 'tanh':
                    np.tanh(cs, cs)
                if data_transform == 'tanh_abs':
                    np.tanh(cs, cs)
                    np.abs(cs, cs)

            sub_res = {
                'pos': pos,
                'left': left_pos,
                'right': right_pos - 1
            }

            if rle > 0:
                cs_t = np.transpose(np.copy(cs))
                disc = np.copy(cs_t)
                cs_t[cs_t < activation_threshold] = 0
                disc[disc >= activation_threshold] = 1
                disc[disc < activation_threshold] = 0

                for i in range(0, len(disc)):
                    state = disc[i]
                    lengths, pos, values = hf.rle(state)
                    offset = int(1 - values[0])
                    lengths_1 = lengths[offset::2]
                    pos_1 = pos[offset::2]
                    del_pos = np.argwhere(lengths_1 <= rle)
                    for p in del_pos:
                        cs_t[i, pos_1[p]:pos_1[p] + lengths_1[p]] = 0
                sub_res['data'] = cs_t if raw else [[round(y, round_values) for y in x] for x in cs_t.tolist()]

            else:
                if transpose:
                    sub_res['data'] = np.transpose(cs) if raw else [[round(y, round_values) for y in x] for x in
                                                                    np.transpose(cs).tolist()]
                else:
                    sub_res['data'] = cs if raw else [[round(y, round_values) for y in x] for x in cs.tolist()]

            # add count of active cells -- !!! cs will be destroyed here !!!
            if add_active_cells:
                activation_threshold_corrected = activation_threshold
                # already tanh applied if necessary

                a = cs
                a[a >= activation_threshold_corrected] = 1
                a[a < activation_threshold_corrected] = 0

                sum_active.append(np.sum(a, axis=1).tolist())

            del cs
            res.append(sub_res)

        return res, sum_active

    def get_words(self, pos_array, left=10, right=0, raw=False, round_values=5, add_embeddings=False):
        ws = self.config['word_sequence']
        word_sequence = self.h5_files[ws['file']][ws['path']]
        embeddings = []
        has_embedding = 'file' in self.config['word_embedding']
        if add_embeddings and has_embedding:
            we = self.config['word_embedding']
            embeddings = self.h5_files[we['file']][we['path']]

        res = []
        cluster = []
        for pos in pos_array:
            left_pos = pos - min(left, pos)
            right_pos = min(len(word_sequence), pos + 1 + right)

            word_ids = word_sequence[left_pos:right_pos]

            words = []
            if 'dict_file' in ws:
                mapper = self.dicts_id_value[ws['dict_file']]
                words = [mapper[x] for x in word_ids.tolist()]
            sub_res = {
                'pos': pos,
                'word_ids': word_ids.tolist(),
                'words': words,
                'left': left_pos,
                'right': right_pos - 1
            }

            if add_embeddings and has_embedding:
                emb = embeddings[left_pos:right_pos]
                sub_res['embeddings'] = emb if raw else [[round(y, round_values) for y in x] for x in emb.tolist()]

            res.append(sub_res)

        return res

    def get_meta(self, name, pos_array, left=10, right=0):
        meta = self.config['meta']
        if name not in meta:
            return []

        meta_data_info = meta[name]
        meta_data = self.h5_files[meta_data_info['file']][meta_data_info['path']]

        meta_index = meta_data_info.get('index')
        if not meta_index:
            meta_index = 'self'

        res = []
        if meta_index == 'self':  # if meta info is related to global coordinates
            for pos in pos_array:
                left_pos = pos - min(left, pos)
                right_pos = min(len(meta_data), pos + 1 + right)

                res.append(meta_data[left_pos:right_pos].tolist())
        else:  # if meta info is a based on indices from global coordinates (like word index)
            position_data = self.h5_files[self.config[meta_index]['file']][self.config[meta_index]['path']]
            for pos in pos_array:
                left_pos = pos - min(left, pos)
                right_pos = min(len(position_data), pos + 1 + right)
                meta_indices = position_data[left_pos:right_pos].tolist()
                res.append([meta_data[ind].tolist() for ind in meta_indices])

        # if there is a dict:
        if 'dict' in meta_data_info:
            mapper = self.dicts_id_value[meta_data_info['dict']]
            res = [[mapper[y] for y in x] for x in res]

        return res

    def get_alignment(self, pos_array, source, left, right, state_threshold, embedding_threshold,
                      data_transform='tanh', cell_selection=None):
        """aligns ngrams for all pos of pos_array against ngram of pos_array[0]


        :param pos_array: list of positions
        :param source: path in states.h5
        :param left: length left context
        :param right: length right context
        :param cell_selection: selection of cells
        :param data_transform: 'tanh' (values: 'tanh', 'tanhabs', 'raw')
        :param state_threshold: default .6
        :param embedding_threshold: default .6
        :return: array of alignment information for each pos in pos_array
        """

        # TODO: implement padding for non-equal length positions

        if cell_selection is None:
            cell_selection = []
        states, _ = self.get_states(pos_array, source, left, right,
                                    raw=True,
                                    data_transform=data_transform, cell_selection=cell_selection)
        words_and_embedding = self.get_words(pos_array, left, right,
                                             raw=True,
                                             add_embeddings=True)

        res = []
        s1 = None

        for i in range(0, len(pos_array)):
            item = {'pos': pos_array[i]}
            state = states[i]
            word = words_and_embedding[i]

            if not s1:
                s1 = [State(w, s, e, state_threshold, embedding_threshold) for w, s, e in
                      zip(word['words'], state['data'], word['embeddings'])]
                s1.reverse()

            s2 = [State(w, s, e, state_threshold, embedding_threshold) for w, s, e in
                  zip(word['words'], state['data'], word['embeddings'])]
            s2.reverse()

            typ, aligned, diff_order = hf.align_forward(s1, s2)

            item['diff_order'] = diff_order
            item['align_typ'] = typ
            item['align_text'] = aligned
            res.append(item)

        return states, words_and_embedding, res

    def get_dimensions(self, pos_array, source, left, right, dimensions, round_values=5, embedding_threshold=.6,
                       state_threshold=.6, data_transform='tanh', cells=None, activation_threshold=.3, rle=0):
        """ selective information for a sequence

        :param pos_array: list of positions
        :param source: path in states.h5
        :param left: positions left from pos
        :param right: positions right from pos
        :param dimensions: list of data dimensions to return
        :param round_values: round values to x digits
        :param embedding_threshold: see :func:`get_alignment`
        :param state_threshold: see :func:`get_alignment`
        :param data_transform: see :func:`get_alignment`
        :param cells: selection of cells
        :param activation_threshold: threshold for activation
        :return: object for all dimensions
        """
        if cells is None:
            cells = []
        res = {}
        states = None
        words_and_embedding = None

        # align already needs states and words.. so why not reuse them :)
        if 'align' in dimensions:
            _, words_and_embedding, res['align'] = self.get_alignment(pos_array, source,
                                                                      left, right,
                                                                      state_threshold, embedding_threshold,
                                                                      data_transform, cell_selection=cells)

        for dim in dimensions:
            if dim == 'states':
                # TODO: contradicts with cell_count call
                # if states:  # reuse states from alignment
                #     for st in states:
                #         st['data'] = [[round(y, round_values) for y in x] for x in st['data'].tolist()]
                #     res[dim] = states
                # else:
                res[dim], cell_active = self.get_states(pos_array, source, left, right,
                                                        round_values=round_values,
                                                        data_transform=data_transform,
                                                        cell_selection=cells,
                                                        activation_threshold=activation_threshold,
                                                        add_active_cells=('cell_count' in dimensions),
                                                        transpose=True, rle=rle)
                if 'cell_count' in dimensions:
                    res['cell_count'] = cell_active
            elif dim == 'words':  # reuse words from alignment
                # if words_and_embedding:
                #     for we in words_and_embedding:
                #         del we['embeddings']
                #     res[dim] = words_and_embedding
                # else:
                res[dim] = self.get_words(pos_array, left, right)
            elif dim.startswith('meta_'):
                res[dim] = self.get_meta(dim[5:], pos_array, left, right)

        return res

    def get_rle(self, cells, source, data_transform='tanh', threshold=.3, min_pass=100, add_words=True):
        cell_states, data_transformed = self.get_cached_matrix(data_transform, source)

        res = []
        for cell in cells:
            cell_data = cell_states[:, cell]
            if not data_transformed:
                if data_transform == 'tanh':
                    np.tanh(cell_data, cell_data)
            z, p, _ = hf.rle(np.where(cell_data > threshold, [1], [-1]))
            lx = np.where(z >= min_pass)
            lx_pos = p[lx]
            lx_length = z[lx].tolist()
            sub_res = {
                'cell': cell,
                'rle_length': lx_length,
                'rle_pos': lx_pos.tolist()
            }
            if add_words:
                words_start = map(lambda w: w['words'], self.get_words(lx_pos, left=1, right=1))
                words_end = map(lambda w: w['words'], self.get_words(lx_pos + lx_length, left=1, right=1))

                sub_res['words'] = zip(words_start, words_end)

            res.append(sub_res)
        return res

    def get_closest_sequences(self, cells, source, length, epsilon_left=0, epsilon_right=0, activation_threshold=.3,
                              data_transform='tanh'):
        """ deprecated """

        cell_states, data_transformed = self.get_cached_matrix(data_transform, source)

        print 'before cs:', '{:,}'.format(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
        q = np.zeros((length + epsilon_left + epsilon_right, len(cells)))
        q[epsilon_right:(epsilon_right + length), :] = 1
        q[:epsilon_right, :] = -1
        q[epsilon_right + length:epsilon_right + length + epsilon_left, :] = -1

        activation_threshold_corrected = activation_threshold
        if not data_transformed:
            activation_threshold_corrected = np.arctanh(activation_threshold)
        # print 'cs:', '{:,}'.format(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
        # print 'before 2 cs:', '{:,}'.format(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)

        cs = cell_states[:, cells]
        # print 'before 2 cs:', '{:,}'.format(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
        cs[cs >= activation_threshold_corrected] = 1
        cs[cs < activation_threshold_corrected] = -1

        # print 'subm cs:', '{:,}'.format(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
        out = scipy.signal.convolve2d(cs, q,
                                      mode="valid").flatten()

        # print 'out cs:', '{:,}'.format(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
        # print 'cs:', '{:,}'.format(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)

        sorted_indices = np.argsort(out)[-50:][::-1]
        sorted_values = out[sorted_indices]

        # correct for left offset
        sorted_indices += epsilon_left
        res = zip(sorted_indices, sorted_values)

        del out
        del cs
        # del sub_matrix

        print 'after-colect cs:', '{:,}'.format(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)

        return res

    def get_closest_sequences_2(self, cells, source, activation_threshold=.3,
                                data_transform='tanh', add_histograms=False, phrase_length=0, sort_mode='cells'):
        """ search for the longest sequences given the activation threshold and a set of cells

        :param cells: the cells
        :param source: path in states.h5
        :param activation_threshold: threshold
        :param data_transform: applied data transformation (tanh, tanhabs, raw)
        :return: list of (position, variance of no. active cells, length of longest activation of all cells)
        """
        cell_states, data_transformed = self.get_cached_matrix(data_transform, source)

        print 'before cs:', '{:,}'.format(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
        # q = np.zeros((length + epsilon_left + epsilon_right, len(cells)))
        # q[epsilon_right:(epsilon_right + length), :] = 1
        # q[:epsilon_right, :] = -1
        # q[epsilon_right + length:epsilon_right + length + epsilon_left, :] = -1

        activation_threshold_corrected = activation_threshold
        if not data_transformed:
            activation_threshold_corrected = np.arctanh(activation_threshold)

        # cs = cell_states[:, cells]
        # cs[cs >= activation_threshold_corrected] = 1
        # cs[cs < activation_threshold_corrected] = 0

        pos_intersection = None
        pos_length_map = {}
        cut_off = 1
        if phrase_length > 2:
            cut_off = phrase_length - 1

        print 'out cs 1:', '{:,}'.format(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
        for c in range(0, len(cells)):
            cs = cell_states[:, cells[c]]
            cs[cs >= activation_threshold_corrected] = 1
            cs[cs < activation_threshold_corrected] = 0

            length, pos, value = hf.rle(cs)
            offset = int(1 - value[0])
            l = length[offset::2]
            l2 = np.argwhere(l > cut_off)
            p = pos[offset::2]

            # TODO: could be more memory efficient
            for ll2 in l2:
                k = int(p[ll2])
                a = pos_length_map.get(k)
                if a is None:
                    if pos_intersection is None:  # only fill in first run..
                        pos_length_map[k] = [int(l[ll2])]
                else:
                    pos_length_map[k].append(int(l[ll2]))

            if pos_intersection is not None:
                pos_intersection = np.intersect1d(pos_intersection, p[l2])
            else:
                pos_intersection = p[l2]
            print pos_intersection.shape
            if pos_intersection.shape[0] == 0:
                break

        # print pos_intersection.shape
        # print len(pos_length_map)
        print 'out cs 2:', '{:,}'.format(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)

        # print map(lambda x: {'pos': x, 'l': min(pos_length_map[x]), 'lengths': pos_length_map[x]}, pos_intersection)

        res = []
        all_pos = pos_intersection.flatten()
        if sort_mode == 'cells':
            # sort by minimal number of other active cells
            for p in all_pos:  # all positions where all pivot cells start jointly
                min_length = np.min(pos_length_map[p])  # max length covered by all cells

                # get the slice of cell states for the range
                cs = cell_states[p:p + min_length - 1, :]
                # discretize
                cs[cs >= activation_threshold_corrected] = 1
                cs[cs < activation_threshold_corrected] = 0

                # build sum
                cs_sum = np.sum(cs, axis=0)

                # set all pivot cells to zero and discretize again
                cs_sum[cells] = 0
                cs_sum[cs_sum > 0] = 1
                res.append([p, np.var(pos_length_map[p]), min_length, float(np.sum(cs_sum))])

            def key(elem):
                return -elem[3], -elem[2]
        else:
            # sort by clean cut
            res = map(lambda xx: [xx, np.var(pos_length_map[xx]), np.min(pos_length_map[xx]), 0], all_pos)

            def key(elem):
                return elem[1], -elem[2]

        # res.sort(key=lambda x: x[1], reverse=False)
        # res.sort(key=lambda x: x[2], reverse=True)

        meta = {}
        if add_histograms:
            meta['fuzzy_length_histogram'] = np.bincount([x[2] for x in res])
            meta['strict_length_histogram'] = np.bincount([x[2] for x in res if x[1] == 0])

        if phrase_length > 1:
            res = [x for x in res if x[2] == phrase_length]

        res.sort(key=key)

        res = res[:50]

        return res, meta

    def get_cached_matrix(self, data_transform, source, full_matrix=False):
        """ request the cached full state matrix or a reference to it

        :param data_transform: 'tanh' (values: 'tanh', 'tanhabs', 'raw')
        :param source: path in states.h5
        :param full_matrix: requires the full matrix to be loaded
        :return: tuple(the matrix [reference], has the matrix been data_transformed)
        :rtype: (matrix, bool)
        """

        source_file = source.split('::')[0]
        source = source.split('::')[1]
        cache_id = str(source) + '__' + str(data_transform) + '__' + str(source_file)
        print 'cs:', '{:,}'.format(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)

        if cache_id not in self.cached_matrix and full_matrix:
            cell_states = self.h5_files[source_file][source]
            if data_transform == 'tanh':
                # x = np.zeros(shape=cell_states.shape)
                x = np.clip(cell_states, -1, 1)
                self.cached_matrix[cache_id] = x
            elif data_transform == 'tanh_abs':
                # x = np.zeros(shape=cell_states.shape)
                x = np.clip(cell_states, -1, 1)
                np.abs(x, x)
                self.cached_matrix[cache_id] = x

        if cache_id in self.cached_matrix:
            transformed = True
            matrix = self.cached_matrix[cache_id]
        else:
            transformed = False
            matrix = self.h5_files[source_file][source]
        # print 'cs:', '{:,}'.format(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)

        return matrix, transformed
