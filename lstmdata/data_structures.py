from scipy.spatial.distance import cosine

__author__ = 'Hendrik Strobelt'


class State:
    def __init__(self, word, state, embedding, state_threshold=.6, embedding_threshold=.6):
        self.word = word
        self.state = state
        self.embedding = embedding  # rs.weights[rs.word2id[word] - 1]
        self.s_th = state_threshold
        self.e_th = embedding_threshold

    def __hash__(self):
        return 0

    def __eq__(self, w2):
        return cosine(self.state, w2.state) < self.s_th and cosine(self.embedding, w2.embedding) < self.e_th
