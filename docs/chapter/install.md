## Getting started

Install python requirements in your virtual environment:

```
pip install -r requirements.txt
```

Install bower requirements:

```
cd client; bower install; cd ..
```

start server:

```
python server.py -dir <datadir>
```

open browser at [http://localhost:8888](http://localhost:8888)


## Data Directory
LSTMVis parses all subdirectories of `<datadir>` for config files `lstm.yml`.
A typical `<datadir>` might look like this:

```
<datadir>
├── parens  <--- minimal example
│   ├── lstm.yml
│   ├── states.h5
│   ├── train.h5
│   └── words.dict
├── ptb_word  <-- with search functionality and meta data (part-of-speech,..)
│   ├── embeddings.h5
│   ├── indexdir
│   │   └── ...
│   ├── lstm.yml
│   ├── pos.dict
│   ├── pos.h5
│   ├── states.h5
│   ├── train.h5
│   ├── weight.h5
│   └── words.dict


```



a simple example of `lstm.yml` is:

```yaml
name: rls - ep 10  # project name

files: # assign files to reference name
  states: rls_200_ep10_states.h5 # HDF5 files have to end with .h5 !!!
  train: rls.h5
  words: rls.dict # dict files have to end in .dict !!

word_sequence: # defines the word sequence
  file: train # HDF5 file
  path: words # path to table within HDF5
  dict_file: words # dictionary to map IDs from HDF5 to words

states:
  file: states # HDF5 files containing the state for each position
  types: [
  	{type: state, layer: 1, path: states1}, # type={state, output}, layer=[1..x], path = HDF5 path
  	{type: output, layer: 1, path: output1}, 
	{type: state, layer: 2, path: states2},
  	{type: output, layer: 2, path: output2}
  ]

```
