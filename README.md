# HeartVista-ML-Integration
One of my research projects at Stanford (Summer 2019)

This application continuously infers the next best trajectory to
sample using an arbitrary tensorflow ML model. The model takes in
an input of [1, 256, 256, 1] so the output image of the scanner
had to be formatted to this size and put into the model as complex
data. The model then outputs the predicted trajectory, which is
passed along to the scanner, which updates the sampling pattern.
Unfortunately, the sampling pattern cannot be updated while the 
current one is playing so there may be a delay of one or two 
trajectories. The scanner will repeat the last selected trajectories
to maintain a steady state until the next sampling pattern can
be implemented. 
The base of this code is from the Brain Localizer application, which is
a default HeartVista application that incorporates tensorflow models.
It is also advantageous because it acquires data one acquisition at a 
time, rather than just constantly acquiring at a high rate.
