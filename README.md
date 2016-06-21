# ![](docs/img/logo_sm.png) Visual Analysis for State Changes in RNNs

More information about LSTMVis, an introduction video, and the link to the live demo can be found at **[lstm.seas.harvard.edu](http://lstm.seas.harvard.edu)**

<div style='text-align:center'>
<img src="docs/img/teaser_V2_small.png" />
</div>


## Install

Clone the repository:

```bash
git clone https://github.com/HendrikStrobelt/LSTMVis.git; cd LSTMVis
```

Install python (server-side) requirements using [pip](https://pip.pypa.io/en/stable/installing/):

```bash
pip install -r requirements.txt
```

Install [bower](https://bower.io/) (client side) requirements:

```bash
cd client; bower install; cd ..
```

Download example dataset(s):

```bash
wget <xxx>; unzip <xxx>
```


start server:

```bash
python server.py -dir <datadir>
```

open browser at [http://localhost:8888](http://localhost:8888) - eh voila !


## Adding Your Own Data

If you want to train your own data first, please read the [Training](docs/chapter/train.md) document. If you have your own data at hand, adding it to LSTMVis is very easy. You only need three files:

* HDF5 file containing the state vectors for each time step (e.g. `cbt_epoch10.h5`)
* HDF5 file containing a word ID for each time step (e.g. `train.h5`)*
* Dict file containing the mapping from word ID to word (e.g. `words.dict`)*

A schematic representation of the data:

![Data Format](docs/img/docu_data.png)


*If you don't have these files yet, but a space-separated `.txt` file of your training data instead, check out our [text conversion tool](docs/chapter/tools.md#convert-.txt-to-.h5-and-.dict)


### Data Directory
LSTMVis parses all subdirectories of `<datadir>` for config files `lstm.yml`.
A typical `<datadir>` might look like this:

```
<datadir>
├── children_book  		<--- project directory
│   ├── lstm.yml 		<--- config file
│   ├── cbt_epoch10.h5 	<--- states for each time step
│   ├── train.h5 		<--- word ID for each time step
│   └── words.dict 		<--- mapping word ID -> word
├── fun .. 
```


### Config File

a simple example of an `lstm.yml` is:

```yaml
name: children books  # project name
description: children book texts from the Gutenberg project # little description

files: # assign files to reference name
  states: cbt_epoch10.h5 # HDF5 files have to end with .h5 or .hdf5 !!!
  word_ids: train.h5
  words: words.dict # dict files have to end with .dict !!

word_sequence: # defines the word sequence
  file: train # HDF5 file
  path: word_ids # path to table in HDF5
  dict_file: words # dictionary to map IDs from HDF5 to words

states: # section to define which states of your model you want to look at
  file: states # HDF5 files containing the state for each position
  types: [
  	{type: state, layer: 1, path: states1}, # type={state, output}, layer=[1..x], path = HDF5 path
	{type: state, layer: 2, path: states2},
  	{type: output, layer: 2, path: output2}
  ]

```

## Intrigued ? Here is more.. 

Check out our documents about:

* [details about configuring the states file input](docs/chapter/config_states.md)
* [adding annotation files for result heatmaps](docs/chapter/meta.md)
* [training a model with torch](docs/chapter/train.md)
* [tools that make your life easier](docs/chapter/tools.md)






## Credits

LSTMVis is a collaborative project of Hendrik Strobelt, Sebastian Gehrmann, Bernd Huber, Hanspeter Pfister, and Alexander M. Rush at Harvard SEAS.
