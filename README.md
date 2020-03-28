
# Pure Water Embedded Firmware

This firmware sets the functionality of Pure Water Machine Processes, specifically, the 'Processor' circuit board. Currently, no C code is written for the dispensor circuit board. This code currently runs on Particle base firmware which in turn is built ontop of FreeRTOS. The Particle firmware API is almost entirely compatible with the Arduino Wire API, therefore, porting this codebase to Arduino would be only a very short hop. 

**This solves the following problems:**

- mechanisms for I/O to Particle Cloud: reporting errors and status reports to cloud; stop orders/overrides; and receiving configuration changes from remote updates (and saving those updates to EEPROM).
- cadence loop intervals (default runs every second). Instigates collecting all I/O states, error states and setting final state
- setting up a 'state machine' -- for an organized and easily digestable reference of 'truth' at any finite state.
- I/O to actuators and sensors. This includes two mcp23s17 expanders, discrete circuit switches and I2C psi sensors.
- Writing (via SPI) to TFT screen for technician and customer support. 

## Designed as a Component of a Larger System

For the Pure Water Tech team its critical to gain insight into functions and error state of water machines. The machines are transmitting information back up to a Google Cloud environment (via a Particle Cloud jump). And each machine can be configured, overriden and set into special states in order for the team to track down malfunctions, mitigate circumstances and tune to unique circumstances. 

## Cadence Loop Intervals
Water.ino, upon each loop, sets intervals according to cadence setting (default 1 second). Each cycle, intervals.cpp IntervalsCollectIOStates() and IntervalsErrorStates() is called. This essentially loops all I/O instances, Error instances and gets its updated state. Once these methods are called, then we should have all individual pin states and error states for further processing of 'higher level' state conditions. 

## State Machine

The crux of this firmware revolves around the 'State Machine'. This is centered inside of the state.h and state.cpp files. Variables meant to be accessed throughout (via including state.h) are prefixed with 'S_'. These are usually I/Os, config, error, etc. Local state vars (like s_BoosterPumpState) are prefixed with 's_'. These local state vars are the crux of the 'machine state'. For example, what state is the boost pump in? We can't just deduce from the nozzle flow switch. We have to take into account potential error states that might set a stop condition. 

The StateSet() method encapsulates the logic where we eventually derive what states we are in. This method accesses I/O, Errors etc for reference. This method is called on every main cadence loop. Every (once a second (can be configured)) we completely re-assess all state. Re-assessing and resetting ALL state on every loop eliminates a whole slew of potential bugs that happens by updating state piecemeal. 

## I/O
The machine's main I/O is centralized on two Microchip MCP23s17 expander ICs (via SPI). Some inputs are direct, namely the water usage meters. The meters work on interrupts. The machine is a mix of discrete input signals from psi mechanic switches and from analog psi sensors. The first is collected via simple HIGH/LOW reads on the expander ICs. The later is collected via I2C reads.

#### MCP23s17 Expander ICs
I didn't want to do SPI reads every time I needed to reference an individual pin, which would drive a large amounts of needless SPI traffic. Therefore, upon every cadence loop, I do a complete 16bit read on each expander IC. This gives all pin states (HIGH or LOW) AT ONCE in one SPI call (technically 3 or 4 byte exchanges). 

I store this 16bit state reference for the rest of the cadence loop inside of io_expander.cpp (read io_expander.h header comment for further details). Each reference to a pin only accesses memory. To faciliate this process, inside water.ino cadence loop we trigger the reading of ALL expander pins, then we run other processes, and, finally, at the end of the loop, trigger setting ALL expander pins.

#### IO_Expander Class
Inside of state.cpp we create instances of the IO_Expander class FOR EACH input or output. We currently have about 15 instances. Each instance is responsible for keeping track of its own HIGH/LOW state and can be called or set. But the instance doesn't actually have any control of the ACTUAL pin on the expander IC. 

So calling set on an instance won't actually do anything. That happens by calling IOExpander_SetAll(), which takes all states of all instances and collects that into a 16bit register which, in turn, is sent to the IC.

## Errors
Errors are encapsulated in the Error class instances. Each possible error state corresponds to an instance, which is created in state.cpp. These instances are updated upon each cadence loop. And are referenced in determining state of machine (for example, whether to override boost pump state). 

