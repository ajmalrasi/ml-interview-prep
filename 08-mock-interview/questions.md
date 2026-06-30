# Mock Interview — Questions

Answer each **out loud before** opening [model-answers.md](model-answers.md). Time
yourself. The follow-ups are what a real interviewer adds when you answer well.

---

## Stage 1 — Warm-up (5 min)

1. Walk me through your background in 2 minutes. Why this systems-first CV role?
2. This role is explicitly *not* about training models in notebooks — it's about
   making them run on live video. How does your experience map to that?
3. *(follow-up)* Your last 4 years read as data platforms / seismic. Why the move
   back to live vision systems?

## Stage 2 — Rapid-fire fundamentals (10 min)

4. RTSP vs WebRTC — when each?
5. Why is HLS a bad choice for real-time inference delivery?
6. What's the difference between I, P, and B frames? Why might you disable B-frames?
7. Why can't you start decoding a stream at an arbitrary frame?
8. `cv2.VideoCapture("rtsp://...")` — what's wrong with this for 30 cameras?
9. Consumer is slower than the camera. What do you do, and why not just a big buffer?
10. Does Python's GIL prevent a video pipeline from using multiple cores? Explain.
11. FP16 vs INT8 — tradeoffs? What does INT8 need that FP16 doesn't?

## Stage 3 — Deep dive (10 min) — pick the one they steer to

12. **Inference:** Walk me through taking a trained PyTorch detector to the fastest
    stable inference on a Jetson. Every step.
13. *(follow-up)* You quantized to INT8 and mAP dropped 4 points. Debug it.
14. **Fault tolerance:** A camera in a 40-camera system silently freezes — no error,
    last frame just repeats. How do you detect and recover? How do you make sure the
    other 39 are unaffected?
15. *(follow-up)* Your reconnect logic works but logs are flooded and the camera gets
    hammered every 100ms. Fix it.

## Stage 4 — System design (20 min)

16. Design a system to run object detection + tracking on 50 RTSP cameras in a
    warehouse, 24/7, low latency, edge + cloud, that self-heals without human
    intervention. Think out loud.

    Curveballs they'll add (expect 2–3):
    - Now it's 500 cameras.
    - Latency must be under 50ms end to end.
    - The GPU keeps running out of memory.
    - The cloud link drops for an hour.
    - Deploy a new model version with zero downtime.
    - How do you know, in production, that a camera is mispointed and detecting
      nothing useful?

## Stage 5 — Your questions (5 min)

17. What questions do you have for us?
    *(Yes, this is scored. Have 3 sharp ones ready — see model-answers.)*

---

→ Check yourself: **[model-answers.md](model-answers.md)** · Grade:
**[rubric.md](rubric.md)**
