require 'rnn'
require 'hdf5'
require 'nngraph'

cmd = torch.CmdLine()

cmd:option('-data_file','data/','data directory. Should contain data.hdf5 with input data')
cmd:option('-val_data_file','data/','data directory. Should contain data.hdf5 with input data')
cmd:option('-gpuid',-1,'which gpu to use. -1 = use CPU')
cmd:option('-checkpoint_file','checkpoint/','path to model checkpoint file in t7 format')
cmd:option('-output_file','reads/lstm_grads.h5','path to output LSTM gradients in hdf5 format')

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





function get_influence(data, valid_data, model, criterion)
   --local params, grad_params = model:getParameters()
   

   --local all_grads = torch.CudaTensor(data:size(), 35, 20, 650) 
   local all_grads = torch.CudaTensor(data.length * data.batchlength * data.seqlength, 1) 
   --model:forget()
   model:training()
   for i = 1, data:size() do
      if i%100 == 0 or i==2 then
         print(i, "current batch")
      end 
      model:zeroGradParameters()
      local d = data[i]
      input, goal = d[1], d[2]
      ---1. forward
      local out = model:forward(input)
      -- 2. backward criterion
      local deriv = criterion:backward(out, goal)

      -- 3. zero out everything except last
      for z=1, #deriv-1 do
         deriv[z]:fill(0)
      end
      --print('Memory!', cutorch.getMemoryUsage())
      -- 4. backward model
      model:backward(input, deriv)
      -- print(model) 
      -- print(model:get(1).output:size())
      --print('Memory after backwards', cutorch.getMemoryUsage())
      -- 5. get gradweights on lookup table for every word in input
      --all_grads[i] = model:get(2).gradInput:clone()

      local gi = model:get(2).gradInput:clone()
      for csequence=1, gi:size(1) do
         for cbatch=1, gi:size(2) do
            local cindex = (i-1) * data.seqlength
            local batchbonus = (cbatch-1) * data.length
            local new_index = cindex + batchbonus + csequence
            --print(new_index, "new_index!")
            all_grads[new_index] = torch.norm(gi[csequence][cbatch])

         end
      end
      
      collectgarbage()
      --break

   end

   local f = hdf5.open(opt.output_file, 'w')
   f:write('grads', all_grads:float())
   f:close()

end



function main() 
    -- parse input params
   opt = cmd:parse(arg)
   
   if opt.gpuid >= 0 then

      print('using CUDA on GPU ' .. opt.gpuid .. '...')
      require 'cutorch'
      require 'cunn'
      cutorch.setDevice(opt.gpuid + 1)
   end
   
   -- Create the data loader class.
   local train_data = data.new(opt, opt.data_file, opt.use_chars)
   local valid_data = data.new(opt, opt.val_data_file, opt.use_chars)


   criterion = nn.SequencerCriterion(nn.ClassNLLCriterion())
   model = torch.load(opt.checkpoint_file)

   
   if opt.gpuid >= 0 then
      model:cuda()
      criterion:cuda()
   end
   get_influence(train_data, valid_data, model, criterion)
end

main()
