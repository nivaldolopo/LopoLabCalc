import {
  doc,
  onSnapshot,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./client";
import type { Machine } from "@/features/pricing-calculator/types";

// As máquinas ficam num único documento (a lista é editada como um todo na modal).
const machinesDoc = doc(db, "config", "machines");

function toMachine(data: DocumentData): Machine {
  return {
    id: String(data.id ?? ""),
    name: data.name ?? "",
    price: Number(data.price) || 0,
    lifeHours: Number(data.lifeHours) || 0,
    watts: Number(data.watts) || 0,
    maintenancePerHour: Number(data.maintenancePerHour) || 0,
  };
}

/**
 * Escuta as máquinas em tempo real. Chama `onMachines(null)` quando o documento
 * ainda não existe (para o chamador semear/migrar).
 */
export function subscribeMachines(
  onMachines: (machines: Machine[] | null) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    machinesDoc,
    (snapshot) => {
      if (!snapshot.exists()) {
        onMachines(null);
        return;
      }
      const data = snapshot.data();
      const items = Array.isArray(data.items) ? data.items.map(toMachine) : [];
      onMachines(items);
    },
    (error) => onError(error),
  );
}

export async function persistMachines(machines: Machine[]): Promise<void> {
  await setDoc(machinesDoc, {
    items: machines.map((machine) => ({
      id: machine.id,
      name: machine.name,
      price: machine.price,
      lifeHours: machine.lifeHours,
      watts: machine.watts,
      maintenancePerHour: machine.maintenancePerHour,
    })),
  });
}
