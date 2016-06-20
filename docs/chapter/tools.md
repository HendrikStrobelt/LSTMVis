## Tools

LSTMVis comes with some data tools that allow enriching the experience. All the tools can be found in the `tools/` folder.


### Create a Search Index
Nothing is easier than creating an index. If you have your `lstm.yml` properly setup in your `project_dir`, then just run 

```bash
python create_index.py <project_dir>

```

After restarting the server, your project has search functionality. **Be aware, that indexing might take some time.**


### Convert States to Unsigned 
If you want to convert your signed hidden states data to an unsigned version, we provide a tool that does this. It splits a signed hidden state into one state that represents the positive and one that represents the negative ranges:

![sign_unsign](../img/sign_unsign.png)


**Be aware that you need reasonable disk space. For fast access we don't compress the HDF5.** To convert all your states in one HDF5 file use:

```bash
python signed_to_unsigned <input_file> <output_file>

```

After conversion, remember to include your unsigned states in the `lstm.yml` with the `unsigned:true` option