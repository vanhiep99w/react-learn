---
title: "Compound Components"
description: "Nhóm component chia sẻ state ngầm qua Context — API kiểu <Tabs><Tab/></Tabs>, linh hoạt và biểu cảm"
---

# Compound Components

## Mục lục

- [Tổng quan](#tổng-quan)
- [1. Vấn đề: props nổ tung](#1-vấn-đề-props-nổ-tung)
- [2. Ý tưởng compound components](#2-ý-tưởng-compound-components)
- [3. Cài đặt với Context](#3-cài-đặt-với-context)
- [4. Dùng và vì sao nó linh hoạt](#4-dùng-và-vì-sao-nó-linh-hoạt)
- [5. Gắn component con làm thuộc tính](#5-gắn-component-con-làm-thuộc-tính)
- [6. Ưu / nhược điểm](#6-ưu--nhược-điểm)
- [Tài liệu tham khảo](#tài-liệu-tham-khảo)

---

## Tổng quan

**Compound components** là một nhóm component được thiết kế để **làm việc cùng nhau**, chia sẻ state ngầm thông qua Context. API trông như HTML gốc: `<select>` và `<option>`, hay `<Tabs>` và `<Tab>`.

> [!IMPORTANT]
> Pattern này giải quyết vấn đề "component cấu hình bằng quá nhiều props". Thay vì một `<Tabs items={[...]} activeColor=... renderTab=... />` rối rắm, người dùng **ghép** các mảnh con và bạn quản lý state chung phía sau.

---

## 1. Vấn đề: props nổ tung

Một component "all-in-one" cấu hình qua props sẽ phình to khó kiểm soát:

```tsx
// ❌ API cứng nhắc, khó tùy biến: muốn thêm icon? badge? đổi layout 1 tab?
<Tabs
  tabs={[
    { label: 'Hồ sơ', content: <Profile /> },
    { label: 'Cài đặt', content: <Settings /> },
  ]}
  activeIndex={0}
  onChange={...}
  tabClassName="..."
  contentClassName="..."
/>
```

Mỗi nhu cầu mới = thêm một prop. Cuối cùng component có 20 props và vẫn không đủ linh hoạt.

---

## 2. Ý tưởng compound components

Tách thành các mảnh, để người dùng tự sắp xếp; state chung (tab nào đang active) được chia sẻ **ngầm**:

```tsx
// ✅ API biểu cảm, linh hoạt
<Tabs defaultValue="profile">
  <Tabs.List>
    <Tabs.Trigger value="profile">Hồ sơ</Tabs.Trigger>
    <Tabs.Trigger value="settings">⚙️ Cài đặt</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Panel value="profile"><Profile /></Tabs.Panel>
  <Tabs.Panel value="settings"><Settings /></Tabs.Panel>
</Tabs>
```

---

## 3. Cài đặt với Context

State chung (`value` đang chọn) đặt trong Context của `Tabs`; các con đọc Context để biết mình có đang active không.

```tsx
import { createContext, useContext, useState, ReactNode } from 'react';

type TabsCtx = { value: string; setValue: (v: string) => void };
const TabsContext = createContext<TabsCtx | null>(null);

function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Các component Tabs.* phải nằm trong <Tabs>');
  return ctx;
}

function Tabs({ defaultValue, children }: { defaultValue: string; children: ReactNode }) {
  const [value, setValue] = useState(defaultValue);
  return <TabsContext.Provider value={{ value, setValue }}>{children}</TabsContext.Provider>;
}

function List({ children }: { children: ReactNode }) {
  return <div role="tablist" className="tabs-list">{children}</div>;
}

function Trigger({ value, children }: { value: string; children: ReactNode }) {
  const { value: active, setValue } = useTabs();
  const selected = active === value;
  return (
    <button role="tab" aria-selected={selected}
      className={selected ? 'tab active' : 'tab'}
      onClick={() => setValue(value)}>
      {children}
    </button>
  );
}

function Panel({ value, children }: { value: string; children: ReactNode }) {
  const { value: active } = useTabs();
  if (active !== value) return null; // chỉ hiện panel đang active
  return <div role="tabpanel">{children}</div>;
}
```

> [!TIP]
> Ném lỗi rõ ràng trong `useTabs` khi dùng ngoài `<Tabs>` giúp người dùng API của bạn debug nhanh — một dấu hiệu của compound component "có tâm".

---

## 4. Dùng và vì sao nó linh hoạt

```tsx
<Tabs defaultValue="a">
  <Tabs.List>
    <Tabs.Trigger value="a">Tab A</Tabs.Trigger>
    {/* Thêm icon, badge, bất cứ gì — không cần đổi code Tabs */}
    <Tabs.Trigger value="b"><Icon /> Tab B <Badge>3</Badge></Tabs.Trigger>
  </Tabs.List>
  <Tabs.Panel value="a">Nội dung A</Tabs.Panel>
  <Tabs.Panel value="b">Nội dung B</Tabs.Panel>
</Tabs>
```

```mermaid
graph TD
    T["Tabs (giữ state: value)"] -->|Context| L["Tabs.List"]
    T -->|Context| P1["Tabs.Panel"]
    L --> Tr1["Trigger value=a (đọc & set value)"]
    L --> Tr2["Trigger value=b"]
```

Người dùng **toàn quyền** về bố cục, thứ tự, nội dung mỗi mảnh; bạn chỉ quản lý logic "tab nào đang chọn". Đây là **inversion of control** ở mức cao.

---

## 5. Gắn component con làm thuộc tính

Để có API `Tabs.List`, `Tabs.Trigger`, gắn chúng làm thuộc tính của `Tabs`:

```tsx
Tabs.List = List;
Tabs.Trigger = Trigger;
Tabs.Panel = Panel;

export { Tabs };
```

> [!NOTE]
> Cách này gom toàn bộ API vào một import (`import { Tabs }`) và thể hiện rõ quan hệ cha-con. Bạn cũng có thể export riêng từng cái nếu thích cây import phẳng — cả hai đều phổ biến.

---

## 6. Ưu / nhược điểm

| Ưu điểm | Nhược điểm |
|---------|-----------|
| API biểu cảm, đọc như HTML | Cài đặt phức tạp hơn component props |
| Cực kỳ linh hoạt về bố cục | Người dùng phải đặt đúng cấu trúc lồng nhau |
| Không prop drilling giữa các mảnh | State ngầm khó lần hơn props tường minh |
| Mở rộng không cần thêm props | Cần xử lý lỗi khi dùng sai chỗ |

> [!IMPORTANT]
> Dùng compound components khi bạn xây **thư viện UI tái dùng** (tabs, accordion, menu, select, modal) cần linh hoạt cao. Với component đơn giản dùng nội bộ một chỗ, props thường gọn hơn — đừng over-engineer.

---

## Tài liệu tham khảo

- [Composition](/patterns/composition/)
- [Tối ưu Context](/toi-uu-rerender/context-optimization/)
- [Provider Pattern](/patterns/provider-pattern/)
