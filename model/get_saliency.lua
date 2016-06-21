require 'rnn'
require 'hdf5'
require 'nngraph'


--[[
Computes the saliency for each word in a context and saves it
The data should be formatted in a shifting window. each word 
should be the last word of a context once.

Author: Sebastian Gehrmann
--]]


cmd = torch.CmdLine()

cmd:option('-data_file','data/','data directory. Should contain data.hdf5 with input data')
cmd:option('-gpuid',-1,'which gpu to use. -1 = use CPU')
cmd:option('-checkpoint_file','checkpoint/','path to model checkpoint file in t7 format')
cmd:option('-output_file','reads/lstm_grads.h5','path to output LSTM gradients in hdf5 format')

cmd:option('-embedding_index',2,'The index of the embedding layer in the model.')
opt = cmd:parse(arg)


-- Construct the data set.
local data = torch.class("data")
function data:__init(opt, data_file, use_chars)
   local f = hdf5.open(data_file, 'r')
   self.target  = f:read('target'):all()
   self.use_chars = use_chars
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
   else      
      input = self.target[idx]:transpose(1, 2):float():cuda()
      target = nn.SplitTable(2):forward(self.target_output[idx]:float():cuda())
   end
   return {input, target}
end


function get_salience(data, model, criterion)
   local all_grads = torch.CudaTensor(data.length * data.batchlength * data.seqlength, 1) 
   model:training()
   for i = 1, data:size() do
      if i%100 == 0 or i==2 then
         print(i, "current batch")
      end
      model:forget()
      model:zeroGradParameters()
      local d = data[i]
      input, goal = d[1], d[2]
      ---1. forward
      local out = model:forward(input)
      -- 2. backward criterion 
      local deriv = criterion:backward(out, goal)
      -- 3. zero out everything 
      for z=1, #deriv do
         deriv[z]:fill(0)
      end
      -- 3.5 pretend we predict the correct class
      for z=1, deriv[#deriv]:size(1) do
         deriv[#deriv][z][goal[#deriv][z]] = 1
      end
      -- 4. backward model
      model:backward(input, deriv)
      --:get(X) gets the Xth module of the model. 
      --It should point to the embedding layer.
      local gi = model:get(opt.embedding_index).gradInput:clone()
      --Construct the new index in the all_grads tensor 
      for csequence=1, gi:size(1) do
         for cbatch=1, gi:size(2) do
            local cindex = (i-1) * data.seqlength
            local batchbonus = (cbatch-1) * data.length *data.seqlength
            local new_index = cindex + batchbonus + csequence
            --compute the norm of the gradient as saliency
            all_grads[new_index] = torch.norm(gi[csequence][cbatch])

         end
      end
      
      collectgarbage()
   end

   local f = hdf5.open(opt.output_file, 'w')
   f:write('grads', all_grads:float())
   f:close()
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
   
   -- Create the data loader class.
   local train_data = data.new(opt, opt.data_file, opt.use_chars)

   -- Initialize model and criterion.
   criterion = nn.SequencerCriterion(nn.ClassNLLCriterion())
   model = torch.load(opt.checkpoint_file)
   if opt.gpuid >= 0 then
      model:cuda()
      criterion:cuda()
   end
   -- Compute Saliency
   get_salience(train_data, model, criterion)
end

main()
