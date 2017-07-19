import cgi

import os

import h5py
import resource

import numpy as np
import re

import helper_functions as hf

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
        h5files = {k: v for k, v in config['files'].iteritems() if (v.endswith('.h5') or v.endswith('.hdf5'))}
        for key, file_name in h5files.iteritems():
            self.h5_files[key] = h5py.File(os.path.join(directory, file_name), 'r')

        # load all dict files of format: value<space>id
        dict_files = {k: v for k, v in config['files'].iteritems() if (v.endswith('.dict') or v.endswith('.txt'))}
        for name, file_name in dict_files.iteritems():
            kv = {}
            vk = {}
            with open(os.path.join(directory, file_name), 'r') as f:
                for line in f:
                    if len(line) > 0:
                        if len(line.split()) == 2:
                            k, v = line.split()
                            kv[k] = int(v)
                            vk[int(v)] = k
                        elif line[0] == " ":
                            k = " "
                            v = line.strip()
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

        if self.config.get('meta', False):
            for _, m_info in self.config['meta'].iteritems():
                m_info['type'] = m_info.get('type', 'general')
                m_info['index'] = m_info.get('index', 'self')
                m_info['vis']['range'] = m_info['vis'].get('range', '0...100')
                vis_range = m_info['vis']['range']
                if vis_range == 'dict':
                    m_info['vis']['range'] = self.dicts_value_id[m_info['dict']].keys()
                elif type(vis_range) is str:
                    m = re.search("([0-9]+)\.\.\.([0-9]+)", vis_range)
                    if m:
                        m_info['vis']['range'] = range(int(m.group(1)), int(m.group(2)))
        else:
            self.config['meta'] = []

        if self.config.get('etc'):
            self.config['etc']['regex_search'] = self.config['etc'].get('regex_search', False)
        else:
            self.config['etc'] = {"regex_search": False}

        self.config['is_searchable'] = self.config['index'] or self.config['etc']['regex_search']

        if not ('description' in self.config and self.config['description']):
            self.config['description'] = self.config['name']

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
                hf.threshold_discrete(disc, activation_threshold, 0, 1)

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
                hf.threshold_discrete(a, activation_threshold_corrected, 0, 1)

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

        if meta_data_info['type'] == 'general':
            return self._get_meta_general(meta_data_info, pos_array, left, right)
        elif meta_data_info['type'] == 'wordvec':
            return self._get_meta_wordvec(meta_data_info, pos_array, left, right)

        return []

    def _get_meta_wordvec(self, meta_data_info, pos_array, left, right):
        word_indices = self.h5_files[meta_data_info['file']][meta_data_info['path']]
        max_length = len(word_indices)

        has_weights = 'weights_path' in meta_data_info
        word_weights = self.h5_files[meta_data_info['file']][meta_data_info['weights_path']] \
            if has_weights else []

        has_dict = 'dict' in meta_data_info
        word_dict = self.dicts_id_value[meta_data_info['dict']] if has_dict else []

        res_indices = []
        res_weights = []
        res_words = []

        for pos in pos_array:
            left_pos = pos - min(left, pos)
            right_pos = min(max_length, pos + 1 + right)

            wi = word_indices[left_pos:right_pos].tolist()
            res_indices.append(wi)

            if has_dict:
                res_words.append([[word_dict[wi] for wi in row] for row in wi])

            if has_weights:
                weights = word_weights[left_pos:right_pos].tolist()
                res_weights.append(weights)

        return {'word_ids': res_indices, 'words': res_words, 'weights': res_weights}

    def _get_meta_general(self, meta_data_info, pos_array, left, right):
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

    def get_dimensions(self, pos_array, source, left, right, dimensions, round_values=5, data_transform='tanh',
                       cells=None, activation_threshold=.3, rle=0):
        """ selective information for a sequence

        :param rle: filter length
        :param pos_array: list of positions
        :param source: path in states.h5
        :param left: positions left from pos
        :param right: positions right from pos
        :param dimensions: list of data dimensions to return
        :param round_values: round values to x digits
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

        for dim in dimensions:
            if dim == 'states':
                res[dim], cell_active = self.get_states(pos_array, source, left, right,
                                                        round_values=round_values,
                                                        data_transform=data_transform,
                                                        cell_selection=cells,
                                                        activation_threshold=activation_threshold,
                                                        add_active_cells=('cell_count' in dimensions),
                                                        transpose=True, rle=rle)
                if 'cell_count' in dimensions:
                    res['cell_count'] = cell_active
            elif dim == 'words':
                res[dim] = self.get_words(pos_array, left, right)
            elif dim.startswith('meta_'):
                res[dim] = self.get_meta(dim[5:], pos_array, left, right)

        return res

    def query_similar_activations(self, cells, source, activation_threshold=.3,
                                  data_transform='tanh', add_histograms=False, phrase_length=0,
                                  query_mode='fast', constrain_left=False, constrain_right=False, no_of_results=50):
        """ search for the longest sequences given the activation threshold and a set of cells

        :param cells: the cells
        :param source: path in states.h5
        :param activation_threshold: threshold
        :param data_transform: applied data transformation (tanh, tanhabs, raw)
        :return: list of (position, variance of no. active cells, length of longest activation of all cells)
        """
        cell_states, data_transformed = self.get_cached_matrix(data_transform, source)

        # print 'before cs:', '{:,}'.format(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)

        activation_threshold_corrected = activation_threshold
        if not data_transformed:
            activation_threshold_corrected = np.arctanh(activation_threshold)

        cut_off = 2

        # print 'out cs 1:', '{:,}'.format(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)

        if query_mode == "fast":
            num_of_cells_per_sum = 5  # how many cells are evaluated per batch
            maximal_length = int(5e5)  # only consider the first 500,000 time steps
            num_candidates = 1000
        else:  # all time steps but still be memory efficient
            maximal_length = cell_states.shape[0]
            num_of_cells_per_sum = int(np.floor(5e6 / maximal_length))
            num_of_cells_per_sum = 1 if num_of_cells_per_sum == 0 else num_of_cells_per_sum
            num_candidates = 10000

        # print 'num_cells', num_of_cells_per_sum

        cs_cand = None
        # start = time.time()
        no_slices = int(np.ceil(len(cells) * 1. / num_of_cells_per_sum))
        for c in range(0, no_slices):
            cell_range = cells[c * num_of_cells_per_sum:min((c + 1) * num_of_cells_per_sum, len(cells))]
            c_discrete = cell_states[:maximal_length, cell_range]
            hf.threshold_discrete(c_discrete, activation_threshold_corrected, 0, 1)

            if num_of_cells_per_sum > 1:
                c_batch = np.sum(c_discrete, axis=1)
            else:
                c_batch = c_discrete
            if cs_cand is None:
                cs_cand = c_batch
            else:
                cs_cand = cs_cand + c_batch

            del c_discrete, c_batch

        test_cell_number = len(cells)
        test_discrete = np.copy(cs_cand)
        collect_all_candidates = {}
        # start = time.time()
        while test_cell_number > 0 and len(collect_all_candidates) < num_candidates:
            if test_cell_number != len(cells):
                test_discrete[test_discrete > test_cell_number] = test_cell_number
            length, positions, value = hf.rle(test_discrete)
            # positions = np.array(positions)
            if phrase_length > 0:
                indices = np.argwhere((value == test_cell_number) & (length == phrase_length))
            else:
                indices = np.argwhere((value == test_cell_number) & (length >= cut_off))

            if constrain_left and not constrain_right:

                len_pos = set(zip(length[indices].flatten().tolist(), positions[indices].flatten().tolist(),
                                  (test_cell_number - value[indices - 1]).flatten().astype(int).tolist()))
            elif not constrain_left and constrain_right:

                len_pos = set(zip(length[indices].flatten().tolist(), positions[indices].flatten().tolist(),
                                  (test_cell_number - value[indices + 1]).flatten().astype(int).tolist()))
            elif constrain_left and constrain_right:

                len_pos = set(zip(length[indices].flatten().tolist(), positions[indices].flatten().tolist(),
                                  (test_cell_number - value[indices + 1] - value[indices - 1]).flatten().astype(
                                      int).tolist()))
            else:
                len_pos = set(zip(length[indices].flatten().tolist(), positions[indices].flatten().tolist(),
                                  np.zeros(len(indices)).astype(int).tolist()))

            for lp in len_pos:
                key = '{0}_{1}'.format(lp[0], lp[1])
                llp = collect_all_candidates.get(key, lp)
                collect_all_candidates[key] = llp

            test_cell_number -= 1

        all_candidates = list(collect_all_candidates.values())
        all_candidates.sort(key=lambda kk: kk[2], reverse=True)
        # for k, v in enumerate(all_candidates):
        #     if v[1] < 1000:
        #         print 'x', v, k
        all_candidates = all_candidates[:num_candidates]
        # print 'fff'
        # for k, v in enumerate(all_candidates):
        #     if v[1] < 1000:
        #         print 'x', v, k

        cell_count = len(cells)

        res = []

        max_pos = cell_states.shape[0]

        for cand in all_candidates:  # positions where all pivot cells start jointly
            ml = cand[0]  # maximal length of _all_ pivot cells on
            pos = cand[1]  # position of the pattern

            if pos < 1 or pos + ml + 1 > max_pos:
                continue
            # TODO: find a more elegant solution

            cs = np.array(cell_states[pos - 1:pos + ml + 1, :])  # cell values of _all_ cells for the range
            hf.threshold_discrete(cs, activation_threshold_corrected, -1, 1)  # discretize

            # create pattern mask of form -1 1 1..1 -1 = off on on .. on off
            mask = np.ones(ml + 2)
            mask[0] = -1 if constrain_left else 0  # ignore if not constraint
            mask[ml + 1] = -1 if constrain_right else 0  # ignore if not constraint

            cs_sum = np.dot(mask, cs)
            test_pattern_length = ml  # defines the length of the relevant pattern
            test_pattern_length += 1 if constrain_left else 0
            test_pattern_length += 1 if constrain_right else 0

            all_active_cells = np.where(cs_sum == test_pattern_length)[0]  # all cells  that are active for range

            intersect = np.intersect1d(all_active_cells, cells)  # intersection with selected cells
            union = np.union1d(all_active_cells, cells)  # union with selected cells

            res.append({'pos': pos,
                        'factors': [pos, 0, ml,  # int(value[int(indices[ll2]) + 1])
                                    (float(len(intersect)) / float(len(union))),  # Jaccard
                                    cell_count - len(intersect), len(union),
                                    len(intersect)]})  # how many selected cells are not active

        def key(elem):
            return -elem['factors'][6], elem['factors'][5], -elem['factors'][
                2]  # largest intersection, smallest union, longest phrase

        meta = {}
        if add_histograms:
            meta['fuzzy_length_histogram'] = np.bincount([x['factors'][2] for x in res])
            meta['strict_length_histogram'] = np.bincount([x['factors'][2] for x in res if x['factors'][4] == 0])

        if phrase_length > 1:
            res = [x for x in res if x['factors'][2] == phrase_length]

        res.sort(key=key)

        final_res = list(res[:no_of_results])

        # for elem in res_50:
        #     print elem, cell_count, -1. * (cell_count - elem[4]) / float(elem[3] + cell_count)
        # print(constrain_left, constrain_right)
        del res
        # print 'out cs 2:', '{:,}'.format(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)

        return final_res, meta

    def get_cached_matrix(self, data_transform, source, full_matrix=False):
        """ request the cached full state matrix or a reference to it

        :param data_transform: 'tanh' (values: 'tanh', 'raw')
        :param source: path in states.h5
        :param full_matrix: requires the full matrix to be loaded
        :return: tuple(the matrix [reference], has the matrix been data_transformed)
        :rtype: (matrix, bool)
        """

        source_file = source.split('::')[0]
        source = source.split('::')[1]
        cache_id = str(source) + '__' + str(data_transform) + '__' + str(source_file)
        # print 'cs:', '{:,}'.format(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)

        if cache_id not in self.cached_matrix and full_matrix:
            cell_states = self.h5_files[source_file][source]
            if data_transform == 'tanh':
                # x = np.zeros(shape=cell_states.shape)
                x = np.clip(cell_states, -1, 1)
                self.cached_matrix[cache_id] = x

        if cache_id in self.cached_matrix:
            transformed = True
            matrix = self.cached_matrix[cache_id]
        else:
            transformed = False
            matrix = self.h5_files[source_file][source]
        # print 'cs:', '{:,}'.format(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)

        return matrix, transformed

    def is_valid_source(self, source_id):
        split = source_id.split('::')
        if len(split) < 2:
            return False

        source_file = source_id.split('::')[0]
        source = source_id.split('::')[1]

        b = source in self.h5_files[source_file]

        return (source_file in self.h5_files) and \
               (source in self.h5_files[source_file])

    def valid_sources(self):
        res = []
        for x in self.config['states']['types']:
            res.append(x['file'] + '::' + x['path'])
        return res

    def regex_search(self, _query, no_results=20, htmlFormat=False):
        ws = self.config['word_sequence']
        word_sequence = self.h5_files[ws['file']][ws['path']]

        ws_last_pos = len(word_sequence) - 1
        pos = 0
        hits = []
        while pos < ws_last_pos and len(hits) < no_results:
            upper_bound = min((pos + 10000), ws_last_pos)
            word_ids = word_sequence[pos:upper_bound]

            mapper = self.dicts_id_value[ws['dict_file']]
            phrase = ''.join([mapper[x][0] for x in word_ids.tolist()])
            r = [(m.start() + pos, m.end() + pos, m.group(0)) for m in re.finditer(_query, phrase)]
            hits.extend(r)
            if upper_bound < ws_last_pos:
                pos = upper_bound - 1000
            else:
                pos = upper_bound
        res = []
        for h in hits:
            min_pos = max(h[0] - 5, 0)
            max_pos = min(h[1] + 5, ws_last_pos)
            text = ''.join([mapper[x] for x in word_sequence[min_pos:max_pos].tolist()])
            res.append({'index': h[0], 'text': cgi.escape(text)})
        return res

        # if htmlFormat:
        #     # results.formatter = HtmlFormatter()
        #     return map(lambda y: {'index': y['index'], 'text': y.highlights('content')}
        #                , sorted(results, key=lambda k: k['index']))
        # else:
        #     return map(lambda y: {'index': y['index'], 'text': y['content']}
        #                , sorted(results, key=lambda k: k['index']))
