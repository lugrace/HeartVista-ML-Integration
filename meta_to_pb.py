import tensorflow as tf

#Step 1 
#import the model metagraph
# meta_path = "/home/grace/Desktop/grace/dopamine/rainbow20190628_1416_fft_recon_L2_reward_R1/checkpoints/tf_ckpt-9.meta"
meta_path = "/home/parallels/Desktop/dopamine/rainbow20190628_1416_fft_recon_L2_reward_R1/checkpoints/tf_ckpt-9.meta"

saver = tf.train.import_meta_graph(meta_path, clear_devices=True)

#make that as the default graph
graph = tf.get_default_graph()
input_graph_def = graph.as_graph_def()
sess = tf.Session()

#now restore the variables
# pathname = "/home/grace/Desktop/grace/dopamine/rainbow20190628_1416_fft_recon_L2_reward_R1/checkpoints/tf_ckpt-9"
pathname = "/home/parallels/Desktop/dopamine/rainbow20190628_1416_fft_recon_L2_reward_R1/checkpoints/tf_ckpt-9"
saver.restore(sess, pathname)

#Step 2
# Find the output name
graph = tf.get_default_graph()
for op in graph.get_operations(): 
  print (op.name)

#Step 3
from tensorflow.python.platform import gfile
from tensorflow.python.framework import graph_util

# output_node_names = ["Online/fully_connected_1/weights"]
# output_node_names = [n.name for n in tf.get_default_graph().as_graph_def().node]
# output_node_names = [n.name + '=>' +  n.op for n in tf.get_default_graph().as_graph_def().node if n.op in ( 'Softmax','Mul', "Placeholder")]
output_node_names = [n.name for n in tf.get_default_graph().as_graph_def().node if n.op in ( 'Softmax')]
# nodes = [n.name + '=>' +  n.op for n in gf.node if n.op in ( 'Softmax','Mul')]

# print("GRACE")
# # print(output_node_names)
# for next in output_node_names:
# 	print(next)
# print("END GRACE")
# output_node_names = ["sampling_probabilities"]
output_graph_def = graph_util.convert_variables_to_constants(
        sess, # The session
        input_graph_def, # input_graph_def is useful for retrieving the nodes 
        output_node_names)    

#Step 4
#output folder
output_fld ='./'

#output pb file name
output_model_file = 'model.pb'

from tensorflow.python.framework import graph_io

#write the graph
graph_io.write_graph(output_graph_def, output_fld, output_model_file, as_text=False)