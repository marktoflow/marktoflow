import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CronParser, Scheduler, createJob } from '../src/scheduler.js';

describe('CronParser', () => {
  describe('parse', () => {
    it('should parse * * * * * (every minute)', () => {
      const fields = CronParser.parse('* * * * *');

      expect(fields.minute).toHaveLength(60);
      expect(fields.hour).toHaveLength(24);
      expect(fields.day).toHaveLength(31);
      expect(fields.month).toHaveLength(12);
      expect(fields.weekday).toHaveLength(7);
    });

    it('should parse 0 9 * * 1-5 (9am weekdays)', () => {
      const fields = CronParser.parse('0 9 * * 1-5');

      expect(fields.minute).toEqual([0]);
      expect(fields.hour).toEqual([9]);
      expect(fields.weekday).toEqual([1, 2, 3, 4, 5]);
    });

    it('should parse */15 * * * * (every 15 minutes)', () => {
      const fields = CronParser.parse('*/15 * * * *');

      expect(fields.minute).toEqual([0, 15, 30, 45]);
    });

    it('should parse 0,30 * * * * (at 0 and 30 minutes)', () => {
      const fields = CronParser.parse('0,30 * * * *');

      expect(fields.minute).toEqual([0, 30]);
    });

    it('should throw on invalid expression', () => {
      expect(() => CronParser.parse('* * *')).toThrow('Expected 5 fields');
    });
  });

  describe('matches', () => {
    it('should match every minute', () => {
      const date = new Date('2026-01-23T10:30:00');
      expect(CronParser.matches('* * * * *', date)).toBe(true);
    });

    it('should match specific time', () => {
      const date = new Date('2026-01-23T09:00:00');
      expect(CronParser.matches('0 9 * * *', date)).toBe(true);
      expect(CronParser.matches('0 10 * * *', date)).toBe(false);
    });

    it('should match weekdays only', () => {
      const monday = new Date('2026-01-20T09:00:00'); // Monday
      const saturday = new Date('2026-01-25T09:00:00'); // Saturday

      expect(CronParser.matches('0 9 * * 1-5', monday)).toBe(true);
      expect(CronParser.matches('0 9 * * 1-5', saturday)).toBe(false);
    });
  });

  describe('nextRun', () => {
    it('should calculate next run time', () => {
      const after = new Date('2026-01-23T10:30:00');
      const next = CronParser.nextRun('0 11 * * *', after);

      expect(next).not.toBeNull();
      expect(next!.getHours()).toBe(11);
      expect(next!.getMinutes()).toBe(0);
    });

    it('should return null for invalid expression', () => {
      const next = CronParser.nextRun('invalid');
      expect(next).toBeNull();
    });
  });
});

describe('Scheduler', () => {
  let scheduler: Scheduler;

  beforeEach(() => {
    scheduler = new Scheduler(100); // 100ms check interval for testing
  });

  afterEach(() => {
    scheduler.stop();
  });

  it('should add and list jobs', () => {
    const job = createJob('test-job', '/path/to/workflow.md', '* * * * *');
    scheduler.addJob(job);

    expect(scheduler.listJobs()).toHaveLength(1);
    expect(scheduler.getJob('test-job')).toBeDefined();
  });

  it('should remove jobs', () => {
    const job = createJob('test-job', '/path/to/workflow.md', '* * * * *');
    scheduler.addJob(job);

    expect(scheduler.removeJob('test-job')).toBe(true);
    expect(scheduler.listJobs()).toHaveLength(0);
  });

  it('should call callback for due jobs', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    scheduler.onJobDue(callback);

    // Create a job that's already due
    const job = createJob('test-job', '/path/to/workflow.md', '* * * * *');
    scheduler.addJob(job);
    
    // Override nextRun after adding, because addJob recalculates it
    const storedJob = scheduler.getJob('test-job')!;
    storedJob.nextRun = new Date(Date.now() - 1000); // 1 second ago

    await scheduler.runOnce();

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ id: 'test-job' }));
  });

  it('should update job after execution', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    scheduler.onJobDue(callback);

    const job = createJob('test-job', '/path/to/workflow.md', '* * * * *');
    scheduler.addJob(job);
    
    const storedJob = scheduler.getJob('test-job')!;
    storedJob.nextRun = new Date(Date.now() - 1000);

    await scheduler.runOnce();

    const updatedJob = scheduler.getJob('test-job')!;
    expect(updatedJob.runCount).toBe(1);
    expect(updatedJob.lastRun).not.toBeNull();
    expect(updatedJob.nextRun!.getTime()).toBeGreaterThan(Date.now());
  });

  it('should skip disabled jobs', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    scheduler.onJobDue(callback);

    const job = createJob('test-job', '/path/to/workflow.md', '* * * * *');
    job.enabled = false;
    scheduler.addJob(job);
    
    const storedJob = scheduler.getJob('test-job')!;
    storedJob.nextRun = new Date(Date.now() - 1000);

    await scheduler.runOnce();

    expect(callback).not.toHaveBeenCalled();
  });
});

describe('createJob', () => {
  it('should create a job with defaults', () => {
    const job = createJob('my-job', '/workflow.md', '0 9 * * *');

    expect(job.id).toBe('my-job');
    expect(job.workflowPath).toBe('/workflow.md');
    expect(job.schedule).toBe('0 9 * * *');
    expect(job.enabled).toBe(true);
    expect(job.runCount).toBe(0);
    expect(job.inputs).toEqual({});
  });

  it('should accept inputs', () => {
    const job = createJob('my-job', '/workflow.md', '0 9 * * *', { foo: 'bar' });
    expect(job.inputs).toEqual({ foo: 'bar' });
  });
});
