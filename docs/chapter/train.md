## Generate Data

In the model subfolder, we provide a set of tools to (1) preprocess a text file, (2) train an LSTM on the preprocessed data, and (3) generate the evaluation files.

### Requirements

To run our data scripts, you need to install [Torch](http://torch.ch/docs/getting-started.html). For a training on a GPU with cuda, it is required to install [cuda](https://developer.nvidia.com/cuda-downloads) and (cutorch)[https://github.com/torch/cutorch]

### Preprocessing

The preprocessing is done using the script `preprocess.py`. The script takes as input two .txt files, one for the training set and one for the validation set. Its additional parameters are the batch size, the sequence length and the name of the output file. Below is an example call for a parenthesis based data set:

    python preprocess.py data/paren-train.txt data/paren-valid.txt 20 35 paren/train

We also provide the script `preprocess-shifting-window.py` which has the same structure as the normal preprocessing script but instead constructs a shifting window over the text. This is needed for some of the evaluating scripts. For the same data-set as above, a sample call is:

    python preprocess-shifting-window.py data/paren-train.txt data/paren-valid.txt 20 35 paren/train-windowed 
    
The two scripts also produce a dictionary file named `NAME.targ.dict`. This file is needed to map the processed word representations back to the original words.
    
### Training

We provide an implementation of an LSTM in the file main.lua. It has the following options:

```
  -rnn_size      Size of LSTM internal state [650]
  -word_vec_size Dimensionality of word embeddings [650]
  -num_layers    Number of layers in the LSTM [2]
  -epochs        Number of training epochs [10]
  -learning_rate Initial Learning Rate [1]
  -max_grad_norm Max l2-norm of concatenation of all gradParam tensors [5]
  -dropoutProb   Dropoff param [0.5]
  -data_file     The hdf5 file containing the training data [data/]
  -val_data_file The hdf5 file containing the validation data [data/]
  -gpuid         which gpu to use. -1 = use CPU [-1]
  -param_init    Initialize parameters at [0.05]
  -savefile      Filename to autosave the checkpont to [lm_word]
```

The script will automatically save the trained model in a .t7 file after each epoch. These trained models will be used for further processing. 

An examplary call to the script is:

    th main.th -data_file paren/train.hdf5 -val_data_file paren/val.hdf5 -epochs 30 -gpuid 0
    
### Generation of Evaluation Files

The last part is to generate the evaluation files. We provide several scripts that can handle the trained model and extract the data. 

#### States 

The main part of our tool uses the internal state representation of the model. The script `get_states.lua` can extract both the internal state and the output of each layer in the LSTM. Simply call the script with the trained model in the .t7 file and the training data file.

    th get_states.lua -gpuid 0 -data_file paren/train.hdf5 -checkpoint_file trained/lm_paren.t7 -output_file paren/states.hdf5
    
#### Word Embeddings

If you want to extract the word embeddings from the model, you can use the script `get_lookuptable.lua`. This finds the lookuptable in the model and saves the contents to a file. 

    th get_lookuptable.lua -gpuid 0 -output_file "paren/embeddings.hdf5" -checkpoint_file 'trained/lm_paren.t7'

#### Saliency

The saliency is a measure of influence of each word on the prediction. To compute this, we require the data that was preprocessed with `preprocess-shifting-window.py`. We provide to scripts that compute the saliency in different ways.

1. Saliency with respect on the true prediction
2. Saliency with respect on the actual prediction

Most likely you will want to compute it using the first way. The script for this is called `get_saliency.lua`. You can call it with:

    th get_saliency.lua -gpuid 0 -checkpoint_file trained/lm_paren.t7  -data_file 'paren/train-windowed.hdf5' -output_file 'paren/saliency.hdf5'
    
The script for the second way is called `get_influence_per_word.lua` and uses the same parameters (just change the file name in the command).

#### Weights of Linear Layers

The weights of linear layers can be stored in a similar way to the word embeddings with the script `get_linear_weight.lua`. 

    th get_linear_weight.lua -gpuid 0 -output_file "paren/lin-weight.hdf5" -checkpoint_file 'trained/lm_paren.t7'
    
#### Top Predictions

The last script computes the top k predictions at each time step (the actual prediction and their calculated probabilities).

        th get_top_k.lua -gpuid 0 -data_file paren/train.hdf5 -checkpoint_file trained/lm_paren.t7 -output_file paren/topk.hdf5

