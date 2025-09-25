import { describe, it, expect, beforeEach } from "vitest";
import { stringUtf8CV } from "@stacks/transactions";

const ERR_INVALID_SLOTS = 102;
const ERR_LOTTERY_ALREADY_ACTIVE = 106;
const ERR_INVALID_MIN_SLOTS = 110;
const ERR_INVALID_MAX_SLOTS = 111;
const ERR_INVALID_QUOTA_RATE = 116;
const ERR_INVALID_GRACE_PERIOD = 117;
const ERR_INVALID_REGION = 118;
const ERR_INVALID_CURRENCY = 119;
const ERR_INVALID_LOTTERY_TYPE = 115;
const ERR_MAX_LOTTERIES_EXCEEDED = 114;
const ERR_INVALID_UPDATE_PARAM = 113;
const ERR_AUTHORITY_NOT_VERIFIED = 109;

interface Lottery {
  name: string;
  slots: number;
  minSlots: number;
  maxSlots: number;
  quotaRate: number;
  timestamp: number;
  creator: string;
  lotteryType: string;
  gracePeriod: number;
  region: string;
  currency: string;
  status: boolean;
  drawPerformed: boolean;
}

interface LotteryUpdate {
  updateName: string;
  updateSlots: number;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

interface OracleTrait {
  getRandomSeed: () => Result<number>;
}

interface RegistryTrait {
  getTotalApplicants: () => Result<number>;
  getApplicantsByCountry: (country: Uint8Array) => Result<string[]>;
}

class DrawContractMock {
  state: {
    nextLotteryId: number;
    maxLotteries: number;
    activationFee: number;
    authorityContract: string | null;
    admin: string;
    lotteries: Map<number, Lottery>;
    lotteryWinners: Map<number, string[]>;
    lotteryUpdates: Map<number, LotteryUpdate>;
    lotteriesByName: Map<string, number>;
    countryQuotas: Map<string, number>;
  } = {
    nextLotteryId: 0,
    maxLotteries: 100,
    activationFee: 500,
    authorityContract: null,
    admin: "ST1TEST",
    lotteries: new Map(),
    lotteryWinners: new Map(),
    lotteryUpdates: new Map(),
    lotteriesByName: new Map(),
    countryQuotas: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextLotteryId: 0,
      maxLotteries: 100,
      activationFee: 500,
      authorityContract: null,
      admin: "ST1TEST",
      lotteries: new Map(),
      lotteryWinners: new Map(),
      lotteryUpdates: new Map(),
      lotteriesByName: new Map(),
      countryQuotas: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.stxTransfers = [];
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setActivationFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.activationFee = newFee;
    return { ok: true, value: true };
  }

  createLottery(
    name: string,
    slots: number,
    minSlots: number,
    maxSlots: number,
    quotaRate: number,
    lotteryType: string,
    gracePeriod: number,
    region: string,
    currency: string
  ): Result<number> {
    if (this.state.nextLotteryId >= this.state.maxLotteries) return { ok: false, value: ERR_MAX_LOTTERIES_EXCEEDED };
    if (!name || name.length > 100) return { ok: false, value: ERR_INVALID_UPDATE_PARAM };
    if (slots <= 0) return { ok: false, value: ERR_INVALID_SLOTS };
    if (minSlots <= 0) return { ok: false, value: ERR_INVALID_MIN_SLOTS };
    if (maxSlots <= 0) return { ok: false, value: ERR_INVALID_MAX_SLOTS };
    if (quotaRate > 100) return { ok: false, value: ERR_INVALID_QUOTA_RATE };
    if (!["visa", "immigration", "diversity"].includes(lotteryType)) return { ok: false, value: ERR_INVALID_LOTTERY_TYPE };
    if (gracePeriod > 30) return { ok: false, value: ERR_INVALID_GRACE_PERIOD };
    if (!region || region.length > 100) return { ok: false, value: ERR_INVALID_REGION };
    if (!["STX", "USD", "BTC"].includes(currency)) return { ok: false, value: ERR_INVALID_CURRENCY };
    if (this.state.lotteriesByName.has(name)) return { ok: false, value: ERR_LOTTERY_ALREADY_ACTIVE };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.activationFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextLotteryId;
    const lottery: Lottery = {
      name,
      slots,
      minSlots,
      maxSlots,
      quotaRate,
      timestamp: this.blockHeight,
      creator: this.caller,
      lotteryType,
      gracePeriod,
      region,
      currency,
      status: true,
      drawPerformed: false,
    };
    this.state.lotteries.set(id, lottery);
    this.state.lotteriesByName.set(name, id);
    this.state.nextLotteryId++;
    return { ok: true, value: id };
  }

  getLottery(id: number): Lottery | null {
    return this.state.lotteries.get(id) || null;
  }

  performDraw(
    id: number,
    oracle: OracleTrait,
    registry: RegistryTrait
  ): Result<boolean> {
    const lottery = this.state.lotteries.get(id);
    if (!lottery) return { ok: false, value: false };
    if (this.caller !== this.state.admin) return { ok: false, value: false };
    if (lottery.drawPerformed) return { ok: false, value: false };
    if (!lottery.status) return { ok: false, value: false };
    const seedResult = oracle.getRandomSeed();
    if (!seedResult.ok) return { ok: false, value: false };
    const totalResult = registry.getTotalApplicants();
    if (!totalResult.ok) return { ok: false, value: false };
    const seed = seedResult.value;
    const total = totalResult.value;
    const winners: string[] = [];
    for (let i = 0; i < lottery.slots; i++) {
      const index = (seed + i) % total;
      winners.push(`ST${index}WINNER`);
    }
    if (winners.length === 0) return { ok: false, value: false };
    this.state.lotteryWinners.set(id, winners);
    lottery.drawPerformed = true;
    return { ok: true, value: true };
  }

  updateLottery(id: number, updateName: string, updateSlots: number): Result<boolean> {
    const lottery = this.state.lotteries.get(id);
    if (!lottery) return { ok: false, value: false };
    if (lottery.creator !== this.caller) return { ok: false, value: false };
    if (lottery.drawPerformed) return { ok: false, value: false };
    if (!updateName || updateName.length > 100) return { ok: false, value: false };
    if (updateSlots <= 0) return { ok: false, value: false };
    if (this.state.lotteriesByName.has(updateName) && this.state.lotteriesByName.get(updateName) !== id) {
      return { ok: false, value: false };
    }

    const updated: Lottery = {
      ...lottery,
      name: updateName,
      slots: updateSlots,
      timestamp: this.blockHeight,
    };
    this.state.lotteries.set(id, updated);
    this.state.lotteriesByName.delete(lottery.name);
    this.state.lotteriesByName.set(updateName, id);
    this.state.lotteryUpdates.set(id, {
      updateName,
      updateSlots,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  getLotteryCount(): Result<number> {
    return { ok: true, value: this.state.nextLotteryId };
  }

  checkLotteryExistence(name: string): Result<boolean> {
    return { ok: true, value: this.state.lotteriesByName.has(name) };
  }

  setCountryQuota(id: number, country: Uint8Array, quota: number): Result<boolean> {
    const lottery = this.state.lotteries.get(id);
    if (!lottery) return { ok: false, value: false };
    if (lottery.creator !== this.caller) return { ok: false, value: false };
    if (quota <= 0) return { ok: false, value: false };
    this.state.countryQuotas.set(`${id}-${country.toString('hex')}`, quota);
    return { ok: true, value: true };
  }

  resetLottery(id: number): Result<boolean> {
    const lottery = this.state.lotteries.get(id);
    if (!lottery) return { ok: false, value: false };
    if (this.caller !== this.state.admin) return { ok: false, value: false };
    if (!lottery.drawPerformed) return { ok: false, value: false };
    lottery.drawPerformed = false;
    this.state.lotteryWinners.delete(id);
    return { ok: true, value: true };
  }

  deactivateLottery(id: number): Result<boolean> {
    const lottery = this.state.lotteries.get(id);
    if (!lottery) return { ok: false, value: false };
    if (lottery.creator !== this.caller) return { ok: false, value: false };
    lottery.status = false;
    return { ok: true, value: true };
  }
}

describe("DrawContract", () => {
  let contract: DrawContractMock;
  let mockOracle: OracleTrait;
  let mockRegistry: RegistryTrait;

  beforeEach(() => {
    contract = new DrawContractMock();
    contract.reset();
    mockOracle = {
      getRandomSeed: () => ({ ok: true, value: 12345 }),
    };
    mockRegistry = {
      getTotalApplicants: () => ({ ok: true, value: 1000 }),
      getApplicantsByCountry: () => ({ ok: true, value: [] }),
    };
  });

  it("creates a lottery successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createLottery(
      "Visa2025",
      1000,
      500,
      2000,
      50,
      "visa",
      7,
      "Global",
      "STX"
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const lottery = contract.getLottery(0);
    expect(lottery?.name).toBe("Visa2025");
    expect(lottery?.slots).toBe(1000);
    expect(lottery?.minSlots).toBe(500);
    expect(lottery?.maxSlots).toBe(2000);
    expect(lottery?.quotaRate).toBe(50);
    expect(lottery?.lotteryType).toBe("visa");
    expect(lottery?.gracePeriod).toBe(7);
    expect(lottery?.region).toBe("Global");
    expect(lottery?.currency).toBe("STX");
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate lottery names", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createLottery(
      "Visa2025",
      1000,
      500,
      2000,
      50,
      "visa",
      7,
      "Global",
      "STX"
    );
    const result = contract.createLottery(
      "Visa2025",
      2000,
      1000,
      3000,
      60,
      "immigration",
      14,
      "Europe",
      "USD"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_LOTTERY_ALREADY_ACTIVE);
  });

  it("rejects lottery creation without authority contract", () => {
    const result = contract.createLottery(
      "NoAuth",
      1000,
      500,
      2000,
      50,
      "visa",
      7,
      "Global",
      "STX"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects invalid slots", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createLottery(
      "InvalidSlots",
      0,
      500,
      2000,
      50,
      "visa",
      7,
      "Global",
      "STX"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_SLOTS);
  });

  it("performs draw successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createLottery(
      "Visa2025",
      10,
      5,
      20,
      50,
      "visa",
      7,
      "Global",
      "STX"
    );
    contract.caller = "ST1TEST";
    const result = contract.performDraw(0, mockOracle, mockRegistry);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const lottery = contract.getLottery(0);
    expect(lottery?.drawPerformed).toBe(true);
  });

  it("rejects draw if already performed", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createLottery(
      "Visa2025",
      10,
      5,
      20,
      50,
      "visa",
      7,
      "Global",
      "STX"
    );
    contract.performDraw(0, mockOracle, mockRegistry);
    const result = contract.performDraw(0, mockOracle, mockRegistry);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("updates a lottery successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createLottery(
      "OldLottery",
      1000,
      500,
      2000,
      50,
      "visa",
      7,
      "Global",
      "STX"
    );
    const result = contract.updateLottery(0, "NewLottery", 1500);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const lottery = contract.getLottery(0);
    expect(lottery?.name).toBe("NewLottery");
    expect(lottery?.slots).toBe(1500);
    const update = contract.state.lotteryUpdates.get(0);
    expect(update?.updateName).toBe("NewLottery");
    expect(update?.updateSlots).toBe(1500);
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update after draw", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createLottery(
      "Visa2025",
      1000,
      500,
      2000,
      50,
      "visa",
      7,
      "Global",
      "STX"
    );
    contract.performDraw(0, mockOracle, mockRegistry);
    const result = contract.updateLottery(0, "NewLottery", 1500);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("sets country quota successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createLottery(
      "Visa2025",
      1000,
      500,
      2000,
      50,
      "visa",
      7,
      "Global",
      "STX"
    );
    const country = new Uint8Array([85, 83]); // "US"
    const result = contract.setCountryQuota(0, country, 200);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
  });

  it("resets lottery successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createLottery(
      "Visa2025",
      10,
      5,
      20,
      50,
      "visa",
      7,
      "Global",
      "STX"
    );
    contract.performDraw(0, mockOracle, mockRegistry);
    const result = contract.resetLottery(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const lottery = contract.getLottery(0);
    expect(lottery?.drawPerformed).toBe(false);
  });

  it("deactivates lottery successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createLottery(
      "Visa2025",
      1000,
      500,
      2000,
      50,
      "visa",
      7,
      "Global",
      "STX"
    );
    const result = contract.deactivateLottery(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const lottery = contract.getLottery(0);
    expect(lottery?.status).toBe(false);
  });

  it("returns correct lottery count", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createLottery(
      "Lottery1",
      1000,
      500,
      2000,
      50,
      "visa",
      7,
      "Global",
      "STX"
    );
    contract.createLottery(
      "Lottery2",
      2000,
      1000,
      3000,
      60,
      "immigration",
      14,
      "Europe",
      "USD"
    );
    const result = contract.getLotteryCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks lottery existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createLottery(
      "Visa2025",
      1000,
      500,
      2000,
      50,
      "visa",
      7,
      "Global",
      "STX"
    );
    const result = contract.checkLotteryExistence("Visa2025");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const result2 = contract.checkLotteryExistence("NonExistent");
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("parses lottery name with Clarity", () => {
    const cv = stringUtf8CV("Visa2025");
    expect(cv.value).toBe("Visa2025");
  });

  it("rejects lottery creation with empty name", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createLottery(
      "",
      1000,
      500,
      2000,
      50,
      "visa",
      7,
      "Global",
      "STX"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_UPDATE_PARAM);
  });

  it("rejects lottery creation with max lotteries exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxLotteries = 1;
    contract.createLottery(
      "Lottery1",
      1000,
      500,
      2000,
      50,
      "visa",
      7,
      "Global",
      "STX"
    );
    const result = contract.createLottery(
      "Lottery2",
      2000,
      1000,
      3000,
      60,
      "immigration",
      14,
      "Europe",
      "USD"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_LOTTERIES_EXCEEDED);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});