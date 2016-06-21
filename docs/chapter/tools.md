## Tools

LSTMVis comes with some data manipulation tools that should ease your life. All the tools can be found in the `tools/` folder.


### Convert .txt to .h5 and .dict
LSTMVis requires the word sequence and categorical annotations to represented as a combination of an HDF5 (`.h5`) file containing wordIDs and a dictionary (`.dict`) file which describes the mapping of wordIDs to words. If you have your data available as a space-separated list of words, you can use this converter to create `OUTPUTNAME.h5` and `OUTPUTNAME.dict`:

```bash
python txt_to_hdf5_dict.py INPUT.txt OUTPUTNAME
``` 



### Create a Search Index
Nothing is easier than creating an index and add search functionality for your corpus to LSTMVis. If you have your `lstm.yml` properly setup in your `<project_dir>`, then just run: 

```bash
python create_index.py <project_dir>

```

After restarting the server, your project has search functionality. **Be aware, that indexing might take some time.**


### Convert States to Unsigned 
If you want to convert your signed hidden states data into an unsigned version, we provide a tool that splits each signed hidden state into one state that represents the positive part and one that represents the negative part on an absolute scale:

![sign_unsign](../img/sign_unsign.png)


**Be aware that you need reasonable large disk space as this conversion doubles the number of hidden states. For fast access we don't use compressed HDF5 files.** 


To convert all your states in one HDF5 file use:

```bash
python signed_to_unsigned <input_file> <output_file>

```

After conversion, remember to include your unsigned states in the `lstm.yml` with the `unsigned:true` option