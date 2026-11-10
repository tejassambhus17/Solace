import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { journeySummary } from "../../src/progress.js";
import { createApp } from "../src/app.js";
import { Store } from "../src/database.js";
import { isCanonicalTimedPractice } from "../src/timed-practice-contract.js";
import {
  buildWellnessTasks,
  getGuidedProgram,
  guidedPrograms,
  planFocuses,
  planMinutes,
  planTaskActivity,
  wellnessPlanProgress,
  type PlanTask,
} from "../src/wellness-plans.js";

async function fixture() {
  const store = await Store.open(":memory:");
  const api = request(
    createApp({ store, ai: { mode: "offline" }, rateLimits: false }),
  );
  const register = async (email: string) => {
    const response = await api
      .post("/api/auth/register")
      .send({ name: "Plan QA", email, password: "qa-fixture-password" })
      .expect(201);
    return { Authorization: `Bearer ${response.body.token}` };
  };
  return { store, api, register };
}

function completedPractice(planId: string, task: PlanTask, id: string) {
  const canonical = planTaskActivity(task);
  assert.ok(canonical);
  const activity = { ...canonical, environment: "ocean" };
  return {
    id,
    kind: "generated",
    type: activity.type,
    title: activity.title,
    activity,
    environment: activity.environment,
    provider: "offline",
    completed: true,
    durationSec: activity.durationSec,
    plannedDurationSec: activity.durationSec,
    createdAt: new Date().toISOString(),
    planId,
    planTaskId: task.id,
  };
}

test("the builder uses selected focuses and time, and every catalog day is playable", () => {
  for (const goal of planFocuses) {
    for (const minutes of planMinutes) {
      const tasks = buildWellnessTasks(goal, ["sleep", goal], minutes);
      assert.equal(tasks.length, 3);
      assert.equal(tasks[0].focus, goal);
      assert.equal(new Set(tasks.map((task) => task.id)).size, 3);
      for (const task of tasks) {
        assert.ok(task.focus === "sleep" || task.focus === goal);
        assert.equal(planTaskActivity(task)?.durationSec, minutes * 60);
      }
    }
  }
  assert.equal(guidedPrograms.length, 4);
  for (const program of guidedPrograms) {
    assert.equal(getGuidedProgram(program.id), program);
    assert.ok(program.tasks.length > 1);
    for (const task of program.tasks)
      assert.ok(isCanonicalTimedPractice(planTaskActivity(task)));
  }
  assert.equal(getGuidedProgram("missing"), undefined);
});

test("an editable draft starts once and only its owner's saved full practices credit plan days", async () => {
  const { store, api, register } = await fixture();
  try {
    const owner = await register("personal-plan-owner@example.test");
    const other = await register("personal-plan-other@example.test");
    const stamp = new Date().toISOString();
    const draft = {
      id: "personal-qa",
      type: "wellness",
      title: "A calmer week",
      goal: "calm",
      preferredFocuses: ["calm", "sleep"],
      dailyMinutes: 5,
      tasks: buildWellnessTasks("calm", ["calm", "sleep"], 5),
      createdAt: stamp,
    };
    const plans = "/api/records/plans";
    const path = `${plans}/${draft.id}`;
    const sessions = "/api/records/sessions";
    await api
      .post(plans)
      .set(owner)
      .send({ ...draft, id: "program-better-sleep" })
      .expect(400);
    await api.post(plans).set(owner).send(draft).expect(201);
    await api.post(plans).set(owner).send(draft).expect(200);
    const tasks = [
      { ...draft.tasks[0], title: "My quiet reset" },
      ...draft.tasks.slice(1),
    ];
    await api.patch(path).set(owner).send({ tasks }).expect(200);
    await api
      .patch(path)
      .set(owner)
      .send({ tasks: [tasks[0], tasks[0], tasks[2]] })
      .expect(400);
    const completion = completedPractice(draft.id, tasks[0], "first-attempt");
    await api.post(sessions).set(owner).send(completion).expect(400);
    await api.post(sessions).set(other).send(completion).expect(404);
    const started = (
      await api.patch(path).set(owner).send({ startedAt: stamp }).expect(200)
    ).body.record;
    const retried = (
      await api
        .patch(path)
        .set(owner)
        .send({ startedAt: "2026-11-06T10:00:00.000Z" })
        .expect(200)
    ).body.record;
    assert.equal(retried.startedAt, stamp);
    assert.equal(started.tasks[0].title, "My quiet reset");
    await api.patch(path).set(owner).send({ tasks: draft.tasks }).expect(409);
    await api.patch(path).set(owner).send({ goal: "sleep" }).expect(409);
    await api.patch(path).set(other).send({ startedAt: stamp }).expect(404);

    await api
      .post(sessions)
      .set(owner)
      .send({ ...completion, completed: false })
      .expect(400);
    await api
      .post(sessions)
      .set(owner)
      .send({ ...completion, durationSec: 30 })
      .expect(400);
    await api
      .post(sessions)
      .set(owner)
      .send({ ...completion, planTaskId: "unknown-day" })
      .expect(400);
    await api
      .post(sessions)
      .set(owner)
      .send({ ...completion, planTaskId: undefined })
      .expect(400);
    await api
      .post(sessions)
      .set(owner)
      .send({
        ...completion,
        activity: { ...completion.activity, description: "Modified snapshot" },
      })
      .expect(400);

    const responses = await Promise.all([
      api.post(sessions).set(owner).send(completion),
      api
        .post(sessions)
        .set(owner)
        .send({ ...completion, id: "another-attempt" }),
    ]);
    assert.deepEqual(
      responses.map((response) => response.status).sort(),
      [200, 201],
    );
    const savedId = responses[0].body.record.id;
    assert.equal(responses[1].body.record.id, savedId);
    await api
      .patch(`${sessions}/${savedId}`)
      .set(owner)
      .send({ planTaskId: "day-2" })
      .expect(409);
    await api
      .patch(`${sessions}/${savedId}`)
      .set(owner)
      .send({ completed: false })
      .expect(409);

    const state = (await api.get("/api/state").set(owner).expect(200)).body
      .data;
    assert.equal(state.sessions.length, 1);
    assert.equal(journeySummary(state).weeklySeconds, 300);
    assert.deepEqual(wellnessPlanProgress(state.plans[0], state.sessions), {
      completed: 1,
      total: 3,
      done: false,
    });
    const isolated = (await api.get("/api/state").set(other).expect(200)).body
      .data;
    assert.equal(isolated.plans.length, 0);
    assert.equal(isolated.sessions.length, 0);
  } finally {
    store.close();
  }
});

test("catalog starts reopen the same private enrollment and completed days leave legacy checklists intact", async () => {
  const { store, api, register } = await fixture();
  try {
    const owner = await register("catalog-plan-owner@example.test");
    const other = await register("catalog-plan-other@example.test");
    const legacyTasks = [
      { title: "A pause", action: "breathing", completed: true },
    ];
    const plans = "/api/records/plans";
    const legacy = (
      await api
        .post(plans)
        .set(owner)
        .send({
          type: "wellness",
          title: "My original plan",
          tasks: legacyTasks,
        })
        .expect(201)
    ).body.record;
    const program = getGuidedProgram("better-sleep");
    assert.ok(program);
    const start = {
      type: "wellness",
      programId: program.id,
      title: program.title,
      tasks: program.tasks,
      startedAt: new Date().toISOString(),
    };
    await api
      .post(plans)
      .set(owner)
      .send({ ...start, title: "Invented program" })
      .expect(400);
    await api
      .post(plans)
      .set(owner)
      .send({ ...start, programId: "missing" })
      .expect(400);
    const enrollment = (
      await api.post(plans).set(owner).send(start).expect(201)
    ).body.record;
    assert.equal(enrollment.id, "program-better-sleep");
    await api
      .patch(`${plans}/${enrollment.id}`)
      .set(owner)
      .send({ programId: "building-focus" })
      .expect(409);
    const repeated = (
      await api
        .post(plans)
        .set(owner)
        .send({ ...start, startedAt: "2026-11-06T10:00:00.000Z" })
        .expect(200)
    ).body.record;
    assert.deepEqual(repeated, enrollment);
    await api.post(plans).set(other).send(start).expect(201);

    const sessions = "/api/records/sessions";
    const {
      planId: _planId,
      planTaskId: _planTaskId,
      ...standalone
    } = completedPractice(enrollment.id, program.tasks[0], "standalone");
    await api.post(sessions).set(owner).send(standalone).expect(201);
    await api
      .patch(`${sessions}/${standalone.id}`)
      .set(owner)
      .send({ planId: enrollment.id, planTaskId: program.tasks[0].id })
      .expect(409);
    const getState = async (account: typeof owner) =>
      (await api.get("/api/state").set(account).expect(200)).body.data;
    const initial = await getState(owner);
    assert.deepEqual(wellnessPlanProgress(enrollment, initial.sessions), {
      completed: 0,
      total: 3,
      done: false,
    });
    for (const task of program.tasks) {
      const completion = completedPractice(
        enrollment.id,
        task,
        `completion-${task.id}`,
      );
      await api.post(sessions).set(owner).send(completion).expect(201);
    }
    const state = await getState(owner);
    const ownedProgram = state.plans.find(
      (plan: { id: string }) => plan.id === enrollment.id,
    );
    const ownedLegacy = state.plans.find(
      (plan: { id: string }) => plan.id === legacy.id,
    );
    assert.equal(state.plans.length, 2);
    assert.deepEqual(ownedLegacy.tasks, legacyTasks);
    assert.deepEqual(wellnessPlanProgress(ownedLegacy, state.sessions), {
      completed: 1,
      total: 1,
      done: true,
    });
    assert.deepEqual(wellnessPlanProgress(ownedProgram, state.sessions), {
      completed: 3,
      total: 3,
      done: true,
    });
    const isolated = await getState(other);
    assert.deepEqual(
      wellnessPlanProgress(isolated.plans[0], isolated.sessions),
      { completed: 0, total: 3, done: false },
    );
  } finally {
    store.close();
  }
});
