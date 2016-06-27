require 'rnn'
require 'hdf5'
require 'nngraph'

--[[
A simple script to create and train an LSTM model.

Author: Sebastian Gehrmann and Alexander Rush
--]]


cmd = torch.CmdLine()

cmd:option('-rnn_size', 650, 'Size of LSTM internal state')
cmd:option('-word_vec_size', 650, 'Dimensionality of word embeddings')
cmd:option('-num_layers', 2, 'Number of layers in the LSTM')
cmd:option('-epochs', 10, 'Number of training epochs')
cmd:option('-learning_rate', 1, 'Initial Learning Rate')
cmd:option('-max_grad_norm', 5, 'Max l2-norm of concatenation of all gradParam tensors')
cmd:option('-dropoutProb', 0.5, 'Dropoff param')

cmd:option('-data_file','data/','The h5 file containing the training data')
cmd:option('-val_data_file','data/','The h5 file containing the validation data')
cmd:option('-gpuid',-1,'which gpu to use. -1 = use CPU')
cmd:option('-param_init', 0.05, 'Initialize parameters at')
cmd:option('-save_cpu', 0, 'Save the checkpoint files as CPU readable models')
cmd:option('-savefile', 'lm_word','Filename to autosave the checkpont to')

opt = cmd:parse(arg)


-- Construct the data set.
local data = torch.class("data")
function data:__init(opt, data_file)
   local f = hdf5.open(data_file, 'r')
   self.target  = f:read('target'):all()
   self.target_output = f:read('target_output'):all()
   self.target_size = f:read('target_size'):all()[1]

   self.length = self.target:size(1)
   self.seqlength = self.target:size(3)
   self.batchlength = self.target:size(2)
end

function data:size()
   return self.length
end

function data.__index(self, idx)
   local input, target
   if type(idx) == "string" then
      return data[idx]
   elseif opt.gpuid > -1 then      
      input = self.target[idx]:transpose(1, 2):float():cuda()
      target = nn.SplitTable(2):forward(self.target_output[idx]:float():cuda())
   else
      input = self.target[idx]:transpose(1, 2):float()
      target = nn.SplitTable(2):forward(self.target_output[idx]:float())
   end
   return {input, target}
end

-- Train a Model using SGD
function train(data, valid_data, model, criterion)
   local last_score = 1e9
   local params, grad_params = model:getParameters()
   params:uniform(-opt.param_init, opt.param_init)
   for epoch = 1, opt.epochs do
      model:training()
      for i = 1, data:size() do 
         model:zeroGradParameters()
         local d = data[i]
         input, goal = d[1], d[2]
         local out = model:forward(input)
         local loss = criterion:forward(out, goal)         
         deriv = criterion:backward(out, goal)
         model:backward(input, deriv)
         -- Renorm Gradient
         local grad_norm = grad_params:norm()
         if grad_norm > opt.max_grad_norm then
            grad_params:mul(opt.max_grad_norm / grad_norm)
         end
         -- Update Parameters
         params:add(grad_params:mul(-opt.learning_rate))
         
         if i % 100 == 0 then
            print(i, data:size(),
                  math.exp(loss/ data.seqlength), opt.learning_rate)
         end
      end
      local score = eval(valid_data, model)
      local savefile = string.format('%s_epoch%.2f_%.2f.t7', 
                                     opt.savefile, epoch, score)
      if opt.save_cpu > 0 then
         torch.save(savefile, model:clone():float())
      else
         torch.save(savefile, model)
      end
      print('saving checkpoint to ' .. savefile)

      --If Score did not improve, cut the training rate
      if score > last_score - .3 then
         opt.learning_rate = opt.learning_rate / 2
      end
      last_score = score
   end
end

function eval(data, model)
   -- Compute the perplexity of the model
   model:evaluate()
   local nll = 0
   local total = 0 
   for i = 1, data:size() do
      local d = data[i]
      local input, goal = d[1], d[2]
      out = model:forward(input)
      nll = nll + criterion:forward(out, goal) * data.batchlength
      total = total + data.seqlength * data.batchlength
   end
   local valid = math.exp(nll / total)
   print("Valid", valid)
   return valid
end

--Construct a standard LSTM
function make_model(train_data)
   local model = nn.Sequential()
   model.lookups_zero = {}

   model:add(nn.LookupTable(train_data.target_size, opt.word_vec_size))
   model:add(nn.SplitTable(1, 3))

   model:add(nn.Sequencer(nn.FastLSTM(opt.word_vec_size, opt.rnn_size)))   
   for j = 2, opt.num_layers do
      model:add(nn.Sequencer(nn.Dropout(opt.dropoutProb)))
      model:add(nn.Sequencer(nn.FastLSTM(opt.rnn_size, opt.rnn_size)))
   end

   model:add(nn.Sequencer(nn.Dropout(opt.dropoutProb)))
   model:add(nn.Sequencer(nn.Linear(opt.rnn_size, train_data.target_size)))
   model:add(nn.Sequencer(nn.LogSoftMax()))

   model:remember('both') 
   criterion = nn.SequencerCriterion(nn.ClassNLLCriterion())
   
   return model, criterion
end

function main() 
    -- Parse input params
   opt = cmd:parse(arg)
   if opt.gpuid >= 0 then
      print('using CUDA on GPU ' .. opt.gpuid .. '...')
      require 'cutorch'
      require 'cunn'
      cutorch.setDevice(opt.gpuid + 1)
   end
   
   -- Create the data loader classes.
   local train_data = data.new(opt, opt.data_file)
   local valid_data = data.new(opt, opt.val_data_file)

   -- Initialize Model and Criterion.
   model, criterion = make_model(train_data)
   if opt.gpuid >= 0 then
      model:cuda()
      criterion:cuda()
   end

   -- Train the model.
   train(train_data, valid_data, model, criterion)
end

main()
