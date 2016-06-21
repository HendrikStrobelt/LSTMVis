require 'rnn'
require 'hdf5'
require 'nngraph'

--[[
Stores the top k predictions for every time step in a data set. 

Author: Sebastian Gehrmann
--]]

cmd = torch.CmdLine()

cmd:option('-data_file','data/','data directory. Should contain data.hdf5 with input data')
cmd:option('-gpuid',-1,'which gpu to use. -1 = use CPU')
cmd:option('-checkpoint_file','checkpoint/','path to model checkpoint file in t7 format')
cmd:option('-output_file','reads/lstm_grads.h5','path to output LSTM gradients in hdf5 format')
cmd:option('-k', 5,'top k preds')

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


function top_k(data, model)
   local all_tops = torch.CudaTensor(data.length * data.batchlength, opt.k) 
   local all_scores = torch.CudaTensor(data.length * data.batchlength, opt.k)
   -- model:training()
   for i = 1, data:size() do
      if i%100 == 0 or i==2 then
         print(i, "current batch")
      end
      -- model:forget() 
      -- model:zeroGradParameters() 
      local d = data[i]
      input, goal = d[1], d[2]
      --- 1. forward
      local out = model:forward(input)
      out = out[input:size(1)]
      -- 2. get top predictions
      local res, ind = out:topk(opt.k, true)

      for cbatch=1, data.batchlength do
         -- Compute index in storage file. 
         local batchbonus = (cbatch-1) * data.length 
         local new_index = i + data.batchlength * (i-1) + batchbonus
         all_tops[new_index]:copy(ind:narrow(2, cbatch, 1))
         all_scores[new_index]:copy(res:narrow(2, cbatch, 1))
      end
      
      collectgarbage()
   end

   local f = hdf5.open(opt.output_file, 'w')
   f:write('preds', all_tops:float())
   f:write('scores', all_scores:float())
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
   -- Initialize Model.
   model = torch.load(opt.checkpoint_file)
   if opt.gpuid >= 0 then
      model:cuda()
   end
   top_k(train_data, model)
end

main()
