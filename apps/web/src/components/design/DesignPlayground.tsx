"use client";

import { useState } from "react";
import { Button, Checkbox, Drawer, Modal, Segmented } from "@/components/ui";

/** Interactive primitives for the design-system page (internal; sample labels are illustrative). */
export function DesignPlayground() {
  const [seg, setSeg] = useState<"ben" | "bat">("ben");
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(false);
  return (
    <div className="space-y-4">
      <Segmented label="Segmented" value={seg} onChange={setSeg} options={[{ value: "ben", label: "ben" }, { value: "bat", label: "bat" }]} />
      <Checkbox label="Checkbox" description="With description" defaultChecked />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setModal(true)}>Modal</Button>
        <Button size="sm" variant="outline" onClick={() => setDrawer(true)}>Drawer</Button>
      </div>
      <Modal open={modal} onOpenChange={setModal} title="Modal" description="Focus is trapped; Esc closes." footer={<Button onClick={() => setModal(false)}>OK</Button>}>
        <p className="text-sm text-charcoal-600">Radix Dialog with the Kvittel surface, radius and shadow tokens.</p>
      </Modal>
      <Drawer open={drawer} onOpenChange={setDrawer} title="Drawer">
        <p className="text-sm text-charcoal-600">Bottom sheet used for the mobile kvittel preview.</p>
      </Drawer>
    </div>
  );
}
