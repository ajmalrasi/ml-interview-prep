# Calibration & Metrics — Making the Numbers Real

**TL;DR:** Every number in this section — a wait time, a density, a walking speed —
is only as trustworthy as two things: the mapping from pixels to the real world, and
the ground truth you check it against. This page is those two things. The mapping is
a **homography** from the image to the floor plan, and the ground truth is the story
you must be ready to tell when an interviewer asks, "how do you *know* your queue
time is right?"

## Why a single mapping fixes so much

Almost every distortion we've fought — perspective making far people small,
pixel-speed being meaningless, density needing square metres — has the same root
cause: the camera sees a tilted, foreshortened view of a flat floor. The fix is a
**homography**, a 3×3 matrix `H` that maps image pixels to floor-plan coordinates.
It works precisely because the floor is a plane, and a homography is exactly the
transform between two views of a plane.

You build it from correspondences you can measure: pick at least four points you know
in both the image and the real floor — the corners of a floor tile, a painted
marking, the corners of a rectangle you've measured — and solve for `H`.

```
# four (or more) known point pairs → solve for H
H, _ = cv2.findHomography(image_pts, floor_pts)     # floor_pts in metres or cm
foot_world = cv2.perspectiveTransform(foot_image, H)  # project a person's feet
```

The single most common bug here is projecting the wrong point. You must project the
**foot** point, because the feet actually lie on the floor plane the homography
describes. A head floats *above* the plane, so projecting it lands the person in the
wrong spot on the map. Get the feet right and suddenly your distances are in metres,
your areas in square metres, and your speeds in metres per second — which is what
makes density (people per m²), real dwell distance, and honest speed possible. One
thing to do first: undistort the image using the camera's intrinsics (the calibration
covered in section 09), or a wide CCTV lens will bow your straight lines and warp the
homography.

## Stitching cameras together

The same idea scales to a camera network if you calibrate every camera to the *same*
floor coordinate system. Then a person standing at a given spot has the same
real-world coordinates no matter which camera sees them — which is how you avoid
double-counting a crowd that two overlapping cameras can both see, and how you hand a
track from one camera to the next (the cross-camera ReID story in section 14, and the
multi-camera design in section 06). Skip the shared floor frame and two cameras
watching the same crowd will happily count it twice.

## The part candidates skip: proving it's right

You will be asked, in some form, "how do you know this number is accurate?" — and
"it looked right in the demo" is a losing answer. Have a concrete validation story
for each kind of output. For a **count**, take a set of frames, count the people by
hand, and report the mean absolute error against your system. For a **queue time**,
put a stopwatch on a sample of real people moving through the line and report the
average error in seconds. For **events** like line crossings, compare fired events
against a hand-labelled ground truth and report precision and recall. And for the
*tracking* that underpins dwell, the ID-switch rate and MOTA (section 14) are your
early warning, because unstable identities are usually the hidden cause of a noisy
wait time.

The way to sound senior here is to report error **by regime, not as one average**.
Detection-based counting is near-perfect in a sparse scene and collapses in a dense
one; a single blended accuracy number hides exactly the failure a client will notice.
So you'd say "±N people in normal conditions, degrading to X% at peak density," and
you'd know which number you were quoting.

## Why this is never finished

Calibration and accuracy aren't a one-time setup. A cleaner bumps a camera, the sun
moves and the lighting changes, a season shifts the typical crowd, someone re-mounts
a lens a few degrees off — and silently, the homography and the model are now wrong.
Nothing throws an error; the numbers just drift. That's the reason performance
monitoring exists (section 13): you keep watching per-camera metrics over time, and a
count that slowly diverges from a periodic manual audit is your drift alarm going off.

**Self-check.** Why project the foot point rather than the head through the
homography? *(the feet lie on the plane the homography models; the head is above it,
so it lands in the wrong place.)* How do you stop two overlapping cameras
double-counting one crowd? *(calibrate both to a shared floor coordinate system and
de-duplicate by real-world position.)* And when the interviewer says "prove your
queue time is accurate," what's your answer? *(stopwatch a sample of people, report
mean error in seconds, and break it down by crowd regime rather than quoting one
average.)*
