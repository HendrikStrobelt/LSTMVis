# Using LSTMVis with Keras for Document Classification

Written by Mohammadreza Ebrahimi 

This tutorial describes a basic example of training a simple LSTM model for document classification, accessing the states, and prepare them in the format needed for visualization by LSTMvis.

Parameters:
 - `vocab_size`: number of tokens in vocabulary
- `max_doc_length`: length of documents after padding (in Keras, the length of documents are usually padded to be of the same size)
- `num_cells`: number of LSTM cells
- `num_samples`: number of training/testing data samples
- `num_time_steps`: number of time steps in LSTM cells, usually equals to the size of input, i.e., `max_doc_length`
- `trainTextsSeq`: List of input sequence for each document (A matrix with size `num_samples * max_doc_length`).
- `y_train`: vector of document class labels

### Step 1: Preparing and saving the training data
As the first step, we obtain the train vector by reshaping (flattening) the input train sequences and save them for LSTMvis use.
To this end, we use flatten operator to convert a matrix with size (`num_samples * max_doc_length`) into a vector.

```
trainTextsSeq_flatten = trainTextsSeq.flatten()
hf = h5py.File("train.hdf5", "w")
hf.create_dataset('words', data=trainTextsSeq_flatten)
hf.close()
```

Next, we need to reshape the document class labels. In many other usages such as POS tagging, the model emits a value for each input token, while in document classification, the model typically emits a value for each document. To make the class labels consistent with such model, we need to have a vector for each time step. We can reshape the original vector of class labels by repetition. That is, for instance in binary classification, if the sample is positive, all underlying words are labeled as 1, otherwise 0. Towards this goal, we can use tile function as follows:
```
# Reshape y_train: 
y_train_tiled = numpy.tile(y_train, (num_time_steps,1))
y_train_tiled = y_train_tiled.reshape(len(y_train), num_time_steps , 1)
```

### Step 2: Accessing the states
To access the hidden states, we can first train the model on the training data (non-flattened), and then remove the last layer which is dedicated to compute the loss (typically a softmax layer).
Subsequently, we pass the train data via predict function again to run a forward pass without calculating the loss. The outputs are the states that can be saved for LSTMVis usage. Depending on the use case, one can also pass a different data set, e.g. a testing data instead of feeding the training data again. Here we consider accessing the states during the system training so we feed the training data again.

__Note__: In Keras, we need to make sure that `return_sequences` is set to `True` so that each LSTM cell outputs the state vector at each time step. We also need to wrap the softmax layer in Timedistributed wrapper.
The respective code for training the model would be as follows:

```
# max_doc_length vectors of size embedding_size
myInput = Input(shape=(max_doc_length,), name='input') 
x = Embedding(output_dim=embedding_size, input_dim=vocab_Size, input_length=max_doc_length)(myInput)
lstm_out = LSTM(num_cells, return_sequences=True)(x)
predictions = TimeDistributed(Dense(2, activation='softmax'))(lstm_out)
model = Model(inputs=myInput, outputs=predictions)
model.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])
model.fit({'input': trainTextsSeq}, y_train_tiled, epochs=num_epochs, batch_size=num_batch)
```

The following is the code for removing the last layer and accessing the states via running a forward pass.

__Note__: Calling `pop()` would also remove the `TimeDistributed` wrapper (in addition to the last layer), which is the desired behavior.

```
model.layers.pop();
model.summary()
# Save the states via predict
inp = model.input
out = model.layers[-1].output
model_RetreiveStates = Model(inp, out)
states_model = model_RetreiveStates.predict(trainTextsSeq, batch_size=num_batch)
print(states_model.shape)
```

As the final step, we need to reshape the obtained states and save them for LSTMviz. That is, the states are reshaped from (`num_samples * num_time_steps * num_cells`) into (`num_samples * num_time_steps, num_cells`). 

```
# Flatten first and second dimension for LSTMVis
states_model_flatten = states_model.reshape(num_samples * num_time_steps, num_cells)

hf = h5py.File("states.hdf5", "w")
hf.create_dataset('states1', data=states_model_flatten)
hf.close()
```
