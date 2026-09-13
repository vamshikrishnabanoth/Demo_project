# Level 1 Report: Web Technologies Lecture 2: Event Listeners, Event Bubbling & Event Capturing
**Input ID**: `input_13_wt_event_bubbling` | **Input Type**: `VOICE_ONLY` | **Content Style**: `PROCEDURAL`

## 1. Quantitative Metrics Comparison

| Evaluation Dimension | Pipeline A (Summary) | Pipeline B (Blueprint) | Metric Interpretation |
| :--- | :---: | :---: | :--- |
| **Source Grounding** | 0.0% | 0.0% | Grounding in source chunks |
| **Source Answerability** | 0.0% | 0.0% | Answerable from provided material |
| **Average Bloom's Level** | 2.4 / 6.0 | 1.0 / 6.0 | Cognitive depth demand |
| **Material Specificity** | 1.39 / 5.0 | 1.38 / 5.0 | Reflection of specific treatment |
| **Genericness Index** | 1.0 / 5.0 | 1.0 / 5.0 | Lower = More uniquely tailored |
| **Question Diversity** | 0.779 | 0.763 | Intra-suite conceptual variety |
| **Composite Quality (Q)** | **0.19** | **0.119** | Standardized Quality Score |

### **DECISION: SUMMARY**
> Summary produced higher composite quality (Q_A=0.19 vs Q_B=0.119, delta=-0.071) on static/factual content.

## 2. Experiment B1: Blueprint Validity Assessment
- **Topics Grounded in Source**: 0.0%
- **Salience Alignment Score**: 3.0 / 5.0
- **Instructional Act Accuracy**: 100.0%
- **Overall Blueprint Validity**: **35.0%**

## 3. Actual Generated Questions

### Pipeline A Questions (Summary)
**Q1 (REMEMBER)**: In the context of DOM event propagation, what is the correct chronological order of the phases an event undergoes?
- A: Bubbling Phase -> Target Phase -> Capturing Phase
- B: Capturing Phase -> Target Phase -> Bubbling Phase
- C: Target Phase -> Capturing Phase -> Bubbling Phase
- D: Capturing Phase -> Bubbling Phase -> Target Phase
- *Correct*: **B** | *Explanation*: The correct answer is B because the event propagation lifecycle strictly follows the sequence: Capturing (from root to target), Target (at the element), and Bubbling (from target back to root). Option A is incorrect because it reverses the flow, suggesting bubbling happens first. Option C is incorrect because the target phase occurs between capturing and bubbling, not at the start. Option D is incorrect because the target phase is the middle step, not the final one.

**Q2 (UNDERSTAND)**: When using the addEventListener method, what does setting the third argument (useCapture) to true specify?
- A: The listener will only execute during the bubbling phase.
- B: The listener will execute during the capturing phase.
- C: The event will be stopped from propagating further.
- D: The listener will be removed after the first execution.
- *Correct*: **B** | *Explanation*: The correct answer is B because the third parameter of addEventListener determines the phase in which the listener is active; a value of true activates it during the capturing phase. Option A is incorrect because false (or omitting the argument) is required for the bubbling phase. Option C is incorrect because stopping propagation requires calling event.stopPropagation(), not a registration parameter. Option D is incorrect because the once option or manual removal is required to remove a listener, not the useCapture flag.

**Q3 (UNDERSTAND)**: During the execution of an event listener, what is the difference between event.target and event.currentTarget?
- A: event.target is the element where the listener is currently executing, while event.currentTarget is where the event originated.
- B: event.target is the element where the event originated, while event.currentTarget is the element where the listener is currently executing.
- C: Both properties always refer to the same element, regardless of the propagation phase.
- D: event.target refers to the document root, while event.currentTarget refers to the body element.
- *Correct*: **B** | *Explanation*: The correct answer is B because event.target identifies the original source of the event, whereas event.currentTarget identifies the specific element in the DOM tree where the current listener is attached and executing. Option A is incorrect because it swaps the definitions of the two properties. Option C is incorrect because they only refer to the same element when the listener is attached directly to the target element; otherwise, they differ during propagation. Option D is incorrect because these properties are dynamic and do not statically refer to the root or body.

**Q4 (APPLY)**: Which method is used to prevent an event from continuing to propagate through the remaining phases of the DOM tree?
- A: event.preventDefault()
- B: event.stopPropagation()
- C: event.stopImmediatePropagation()
- D: event.cancelBubble = true
- *Correct*: **B** | *Explanation*: The correct answer is B because event.stopPropagation() is the standard method described in the material for preventing an event from reaching other listeners in the remaining propagation phases. Option A is incorrect because preventDefault() stops the browser's default action (like submitting a form) but does not stop propagation to other elements. Option C is incorrect because while stopImmediatePropagation() also stops propagation, the specific method highlighted in the lecture summary for halting the journey through the DOM tree is stopPropagation(). Option D is incorrect because cancelBubble is a legacy, non-standard property not mentioned in the provided material.

**Q5 (ANALYZE)**: If a click event occurs on a button inside a div, and a listener is attached to the div with the useCapture parameter set to false, during which phase will the div's listener execute?
- A: During the capturing phase, before the event reaches the button.
- B: During the target phase, simultaneously with the button's listener.
- C: During the bubbling phase, after the event has reached the button.
- D: The listener will not execute because the event originated on the button.
- *Correct*: **C** | *Explanation*: The correct answer is C because setting useCapture to false (or omitting it) registers the listener for the bubbling phase. Since the event originates on the button (target), it will bubble up to the div after the target phase is complete. Option A is incorrect because capturing requires useCapture to be true. Option B is incorrect because the div is an ancestor, not the target, so its listener does not execute during the target phase. Option D is incorrect because events bubble up through ancestors by default, so the div's listener will execute.

### Pipeline B Questions (Blueprint)
**Q1 (REMEMBER)**: Which JavaScript method is the standard, modern approach to attach an event handler to a DOM element?
- A: element.attachEvent()
- B: element.addEventListener()
- C: element.onEvent()
- D: element.handleEvent()
- *Correct*: **B** | *Explanation*: Option B is correct because `addEventListener` is the standard W3C method for attaching event handlers, allowing multiple listeners for the same event and supporting the capturing/bubbling phases. Option A (`attachEvent`) is an outdated Internet Explorer-specific method that is no longer supported in modern browsers. Option C (`onEvent`) is not a valid DOM method. Option D (`handleEvent`) is a method defined on the EventTarget interface that is called when an event is dispatched, but it is not the method used to *attach* the listener itself.

**Q2 (REMEMBER)**: When using the `addEventListener` method, what are the two primary arguments required to successfully register an event handler?
- A: The event object and the callback function name as a string
- B: The event type string and the callback function reference
- C: The DOM element and the event type string
- D: The callback function and the boolean flag for bubbling
- *Correct*: **B** | *Explanation*: Option B is correct because `addEventListener` requires the type of event (e.g., 'click') as a string and a reference to the function to be executed. Option A is incorrect because the event object is passed to the callback function, not to `addEventListener`, and function names are not passed as strings. Option C is incorrect because the DOM element is the object on which the method is called, not an argument. Option D is incorrect because while a boolean flag can be passed as a third argument, it is optional, and the event type is a mandatory first argument.

**Q3 (REMEMBER)**: During the event bubbling phase, in which direction does the event propagate through the DOM tree?
- A: From the document root down to the target element
- B: From the target element up to the document root
- C: From the target element to its immediate parent only
- D: Simultaneously from the root and the target towards the middle
- *Correct*: **B** | *Explanation*: Option B is correct because bubbling refers to the phase where the event starts at the target element and propagates upward through its ancestors to the document root. Option A describes the capturing phase. Option C is incorrect because bubbling continues all the way to the root, not just the immediate parent. Option D is not a valid description of DOM event propagation phases.

**Q4 (REMEMBER)**: If you call `element.addEventListener('click', handler)` without specifying a third argument, in which phase will the event handler be executed?
- A: The capturing phase
- B: The bubbling phase
- C: The at-target phase only
- D: The event will not propagate to any phase
- *Correct*: **B** | *Explanation*: Option B is correct because the default behavior for `addEventListener` is to listen during the bubbling phase (equivalent to passing `false` or an options object with `capture: false`). Option A is incorrect because capturing requires explicitly setting the third argument to `true` or an options object with `capture: true`. Option C is incorrect because the handler is active during the bubbling phase, which includes the target and ancestors. Option D is incorrect because events do propagate by default.

**Q5 (REMEMBER)**: During the event capturing phase, how does the event travel through the DOM hierarchy?
- A: From the target element up to the document root
- B: From the document root down to the target element
- C: From the target element to its siblings
- D: From the document root to the body element only
- *Correct*: **B** | *Explanation*: Option B is correct because the capturing phase is the first phase of event propagation, where the event travels from the top of the DOM tree (document root) down to the target element. Option A describes the bubbling phase. Option C is incorrect because events do not propagate to siblings. Option D is incorrect because capturing continues all the way to the target element, not just the body.
