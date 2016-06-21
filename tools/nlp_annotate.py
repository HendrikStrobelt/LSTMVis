
import h5py
import spacy

nlp = spacy.load('en')
# Process a document, of any size

#doc = nlp(text)
id2word = {}
with open("words.dict", "r") as f:
    for line in f:
        k, v = line.strip().split()
        id2word[int(v)] = str(k)

h5data = h5py.File('train.h5', 'r')


annotations = []
words = h5data["words"][:]
word_str = [unicode(id2word[w], errors="ignore") for w in words]
t = nlp.tokenizer.tokens_from_list(word_str)

nlp.entity(t)
nlp.tagger(t)
annotations_pos = []
annotations_ner = []
for tok in t:
    annotations_pos.append(tok.pos_)
    annotations_ner.append(tok.ent_type_ if tok.ent_type_.split() else "O")

for annotations, n in ((annotations_pos, "pos"), (annotations_ner, "ner")):
    anno_dict = {}
    for a in annotations:
        if a not in anno_dict:
            anno_dict[a] = len(anno_dict) + 1


    with open(n+".dict", "w") as df:
        for k, v in anno_dict.iteritems():
            print >>df, k, v

    with h5py.File(n+".h5", "w") as vf:
        vf[n] = [anno_dict[a] for a in annotations]
