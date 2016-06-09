require 'nn'
require 'rnn'
require 'nngraph'
require 'hdf5'

cmd = torch.CmdLine()
cmd:option('-checkpoint_file','checkpoint/','path to model checkpoint file in t7 format')
cmd:option('-output_file','checkpoint/lstm_states.h5','path to output LSTM states in hdf5 format')
cmd:option('-gpuid',-1,'which gpu to use. -1 = use CPU')
opt = cmd:parse(arg)

if opt.gpuid >= 0 then
   print('using CUDA on GPU ' .. opt.gpuid .. '...')
   require 'cutorch'
   require 'cunn'
   cutorch.setDevice(opt.gpuid + 1)
end


Module = nn.Module
function Module:get_states()
   --print("get states started")
   if self.modules then
      --print("there are submodules")
      for i,module in ipairs(self.modules) do
	 --print(module)
	 --print(torch.type(module))
         if torch.type(module) == "nn.LookupTable" then
	    --print("found the table")
	    --print(torch.type(module.weight))
            weights =  module.weight   
         else
            module:get_states()
         end
      end
   end
end

model = torch.load(opt.checkpoint_file)
 model:get_states()
local f = hdf5.open(opt.output_file, 'w')
f:write('weights', weights:float())
f:close()
