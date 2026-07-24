import type { Uid } from './dtos';
import type { PushFrame, PushUri } from './pushes';

type UnknownRecord = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUid(value: unknown): value is Uid {
  return typeof value === 'string' && /^(Player|Mayor|NPC)-\d+$/.test(value);
}

function hasString(data: UnknownRecord, key: string): boolean {
  return typeof data[key] === 'string';
}

function hasNumber(data: UnknownRecord, key: string): boolean {
  return typeof data[key] === 'number';
}

function hasUid(data: UnknownRecord, key: string): boolean {
  return isUid(data[key]);
}

function hasKeys(data: UnknownRecord, keys: readonly string[]): boolean {
  return keys.every((key) => key in data);
}

function isPosition(value: unknown): boolean {
  return isRecord(value) && hasNumber(value, 'x') && hasNumber(value, 'y');
}

function isChatData(data: UnknownRecord): boolean {
  const chats = data['chats'];
  if (Array.isArray(chats)) {
    return chats.every(
      (chat) =>
        isRecord(chat) &&
        hasString(chat, 'content') &&
        hasString(chat, 'speaker') &&
        hasUid(chat, 'speakerID')
    );
  }
  return hasUid(data, 'sourceID') && hasUid(data, 'targetID') && hasString(data, 'content');
}

function isMayorNpcCreate(data: UnknownRecord): boolean {
  return (
    hasUid(data, 'uid') &&
    hasNumber(data, 'homeBuilding') &&
    hasNumber(data, 'asset') &&
    hasString(data, 'assetName') &&
    hasString(data, 'model') &&
    hasString(data, 'memorySystem') &&
    hasString(data, 'planSystem') &&
    (typeof data['workBuilding'] === 'number' || data['workBuilding'] === null) &&
    hasString(data, 'nickname') &&
    hasString(data, 'bio') &&
    hasString(data, 'goal') &&
    hasNumber(data, 'cash') &&
    hasNumber(data, 'x') &&
    hasNumber(data, 'y')
  );
}

function isMayorBuildingCreate(data: UnknownRecord): boolean {
  return (
    hasNumber(data, 'id') &&
    hasString(data, 'n') &&
    hasUid(data, 'o') &&
    hasString(data, 't') &&
    hasKeys(data, [
      'lx',
      'ty',
      'rx',
      'by',
      'r',
      'x',
      'y',
      'eI',
      'eE',
      'eT',
      'hC',
      'lC',
      'rI',
      'rT',
    ]) &&
    ['lx', 'ty', 'rx', 'by', 'r', 'x', 'y', 'eI', 'eE', 'eT', 'hC', 'lC', 'rI', 'rT'].every((key) =>
      hasNumber(data, key)
    ) &&
    Array.isArray(data['hL']) &&
    data['hL'].every(isUid) &&
    Array.isArray(data['lL']) &&
    data['lL'].every(isUid)
  );
}

function isPushData(uri: PushUri, data: unknown): boolean {
  if (!isRecord(data)) {
    return false;
  }
  switch (uri) {
    case 'movePath':
      return hasUid(data, 'uid') && Array.isArray(data['path']) && data['path'].every(isPosition);
    case 'moveTo':
      return (
        hasUid(data, 'uid') &&
        hasNumber(data, 'fromX') &&
        hasNumber(data, 'fromY') &&
        hasNumber(data, 'toX') &&
        hasNumber(data, 'toY')
      );
    case 'NPC-React':
    case 'newPlan':
      return hasUid(data, 'uid') && hasKeys(data, [uri === 'NPC-React' ? 'reaction' : 'plan']);
    case 'planToMove':
      return (
        hasUid(data, 'uid') &&
        hasString(data, 'targetBuilding') &&
        hasNumber(data, 'targetBuildingID')
      );
    case 'chatWith':
      return isChatData(data);
    case 'interact':
      return (
        hasUid(data, 'uid') &&
        hasNumber(data, 'equipment') &&
        hasString(data, 'operation') &&
        hasNumber(data, 'continueTime') &&
        hasNumber(data, 'cost') &&
        hasNumber(data, 'earn')
      );
    case 'newAction':
      return hasUid(data, 'uid');
    case 'finishAction':
      return (
        hasUid(data, 'uid') &&
        hasKeys(data, ['action']) &&
        hasNumber(data, 'startTime') &&
        hasNumber(data, 'endTime')
      );
    case 'changeCash':
      return (
        hasUid(data, 'uid') &&
        hasNumber(data, 'cash') &&
        hasNumber(data, 'amount') &&
        (data['effect'] === 'increase' || data['effect'] === 'decrease')
      );
    case 'changeRevenue':
      return (
        hasUid(data, 'uid') &&
        hasNumber(data, 'revenue') &&
        hasNumber(data, 'amount') &&
        (data['effect'] === 'increase' || data['effect'] === 'decrease')
      );
    case 'increaseBuildingIncome':
      return (
        hasUid(data, 'uid') &&
        hasNumber(data, 'building_id') &&
        hasNumber(data, 'income') &&
        hasNumber(data, 'amount')
      );
    case 'mayor.npc.Create':
      return isMayorNpcCreate(data);
    case 'mayor.building.Create':
      return isMayorBuildingCreate(data);
    case 'welcome':
      return false;
  }
}

export function isDispatchablePush(frame: unknown): frame is PushFrame {
  if (!isRecord(frame) || typeof frame['uri'] !== 'string') {
    return false;
  }
  const uri = frame['uri'];
  if (!isPushUri(uri)) {
    return false;
  }
  return uri === 'welcome' || isPushData(uri, frame['data']);
}

export function isPushUri(value: string): value is PushUri {
  return (
    value === 'welcome' ||
    value === 'movePath' ||
    value === 'moveTo' ||
    value === 'NPC-React' ||
    value === 'newPlan' ||
    value === 'planToMove' ||
    value === 'chatWith' ||
    value === 'interact' ||
    value === 'newAction' ||
    value === 'finishAction' ||
    value === 'changeCash' ||
    value === 'changeRevenue' ||
    value === 'increaseBuildingIncome' ||
    value === 'mayor.npc.Create' ||
    value === 'mayor.building.Create'
  );
}

export function isIncomingFrame(frame: unknown): frame is { readonly uri: string } {
  return isRecord(frame) && typeof frame['uri'] === 'string';
}
