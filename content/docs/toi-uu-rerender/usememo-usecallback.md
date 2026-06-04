---
title: "useMemo & useCallback"
description: "Nhớ kết quả tính toán và hàm giữa các lần render — cách hoạt động, dependency array, và khi nào thực sự cần"
---

# useMemo & useCallback

## Mục lục

- [Tổng quan](#tổng-quan)
- [1. useMemo — nhớ một giá trị](#1-usememo--nhớ-một-giá-trị)
- [2. useCallback — nhớ một hàm](#2-usecallback--nhớ-một-hàm)
- [3. useCallback chỉ là useMemo trả về hàm](#3-usecallback-chỉ-là-usememo-trả-về-hàm)
- [4. Dependency array — quy tắc vàng](#4-dependency-array--quy-tắc-vàng)
- [5. Hai lý do chính đáng để dùng](#5-hai-lý-do-chính-đáng-để-dùng)
- [6. Cạm bẫy stale closure](#6-cạm-bẫy-stale-closure)
- [7. Khi nào KHÔNG cần](#7-khi-nào-không-cần)
- [Tài liệu tham khảo](#tài-liệu-tham-khảo)

---

## Tổng quan

`useMemo` và `useCallback` đều là **memoization** (ghi nhớ kết quả): giữ lại giá trị/hàm từ lần render trước và **tái dùng** nếu dependencies không đổi, thay vì tạo lại.

| Hook | Nhớ cái gì | Trả về |
|------|-----------|--------|
| `useMemo(fn, deps)` | **Kết quả** của `fn()` | Giá trị `fn()` trả ra |
| `useCallback(fn, deps)` | **Bản thân hàm** `fn` | Chính hàm `fn` |

> [!IMPORTANT]
> Hai hook này **không làm app nhanh hơn một cách thần kỳ**. Chúng đánh đổi: tốn thêm bộ nhớ + chi phí so sánh deps để **tránh** tạo lại giá trị/hàm. Chỉ đáng khi (1) phép tính thật sự đắt, hoặc (2) bạn cần **ổn định tham chiếu** cho `memo`/`useEffect`. Ngoài hai lý do đó, chúng chỉ làm code rối hơn.

---

## 1. useMemo — nhớ một giá trị

```tsx
import { useMemo, useState } from 'react';

function ProductList({ products, query }: { products: Product[]; query: string }) {
  // Lọc + sắp xếp đắt: chỉ chạy lại khi products HOẶC query đổi
  const visible = useMemo(() => {
    console.log('Đang tính lại danh sách...');
    return products
      .filter((p) => p.name.includes(query))
      .sort((a, b) => b.rating - a.rating);
  }, [products, query]); // ← dependencies

  return <ul>{visible.map((p) => <li key={p.id}>{p.name}</li>)}</ul>;
}
```

Nếu component re-render vì **lý do khác** (vd state không liên quan đổi) mà `products` và `query` vẫn nguyên → `useMemo` trả lại kết quả cũ, **không** in "Đang tính lại".

> [!NOTE]
> `useMemo` chạy hàm **trong** pha render (đồng bộ). Đừng đặt side effect (fetch, set state) trong đó — chỉ tính toán thuần.

---

## 2. useCallback — nhớ một hàm

Mỗi lần render, một arrow function `() => {...}` viết trong component là một **object hàm mới** (tham chiếu mới). `useCallback` giữ nguyên tham chiếu nếu deps không đổi.

```tsx
import { useCallback, useState } from 'react';

function SearchBar({ onSearch }: { onSearch: (q: string) => void }) {
  return <input onChange={(e) => onSearch(e.target.value)} />;
}

export default function App() {
  const [count, setCount] = useState(0);

  // Không có useCallback: handleSearch là hàm MỚI mỗi render App
  const handleSearch = useCallback((q: string) => {
    fetch(`/api/search?q=${q}`);
  }, []); // deps rỗng → cùng 1 hàm suốt vòng đời

  return (
    <div>
      <button onClick={() => setCount((c) => c + 1)}>{count}</button>
      <SearchBar onSearch={handleSearch} />
    </div>
  );
}
```

> [!TIP]
> `useCallback` chỉ **có ý nghĩa** khi hàm đó được truyền cho một component bọc `memo`, hoặc làm dependency của một hook khác (`useEffect`, `useMemo`). Truyền hàm xuống một component **không** memo thì useCallback chẳng giúp gì — con vẫn render theo cha.

---

## 3. useCallback chỉ là useMemo trả về hàm

Hai dòng sau **tương đương hệt nhau**:

```tsx
const fn = useCallback(() => doSomething(a), [a]);
const fn = useMemo(() => () => doSomething(a), [a]); // useMemo trả về 1 hàm
```

`useCallback(fn, deps)` chính là cú pháp tắt cho `useMemo(() => fn, deps)`. Hiểu điều này giúp bạn không bao giờ lẫn lộn hai hook.

---

## 4. Dependency array — quy tắc vàng

> [!IMPORTANT]
> **Mọi** giá trị reactive (props, state, biến tính từ chúng, hàm khác) mà bạn **dùng bên trong** `fn` **phải** có mặt trong mảng deps. Thiếu deps = dùng giá trị cũ (stale). Đây là lỗi #1 với hai hook này.

```tsx
const [multiplier, setMultiplier] = useState(2);

// ❌ Thiếu multiplier trong deps → luôn nhân với 2 ban đầu, dù multiplier đã đổi
const calc = useMemo(() => (x: number) => x * multiplier, []);

// ✅ Đủ deps
const calc = useMemo(() => (x: number) => x * multiplier, [multiplier]);
```

<Callout type="warn">
Đừng "chữa cháy" cảnh báo lint bằng cách xóa deps khỏi mảng — đó là che giấu bug, không phải sửa bug. Hãy bật rule <code>react-hooks/exhaustive-deps</code> của ESLint và tin nó.
</Callout>

**Cách giảm deps một cách đúng đắn:** dùng updater function để bỏ state khỏi deps.

```tsx
// ❌ phụ thuộc count → mỗi lần count đổi, hàm tạo lại
const inc = useCallback(() => setCount(count + 1), [count]);

// ✅ updater → không cần count trong deps → hàm ổn định suốt đời
const inc = useCallback(() => setCount((c) => c + 1), []);
```

---

## 5. Hai lý do chính đáng để dùng

```mermaid
graph TD
    A["Có nên useMemo/useCallback?"] --> B{"Phép tính NẶNG<br/>(sort/filter/parse khối lớn)?"}
    B -->|Có| OK1["✅ useMemo để khỏi tính lại"]
    B -->|Không| C{"Giá trị/hàm này truyền cho<br/>memo component hoặc<br/>làm dep của effect/memo?"}
    C -->|Có| OK2["✅ Ổn định tham chiếu"]
    C -->|Không| NO["❌ Không cần. Bỏ đi cho gọn."]
```

---

## 6. Cạm bẫy stale closure

`useCallback` "đóng băng" closure với các biến tại thời điểm tạo. Nếu deps thiếu, hàm sẽ nhìn thấy **giá trị cũ**:

```tsx
function Chat() {
  const [text, setText] = useState('');

  // ❌ deps rỗng → send LUÔN gửi text = '' (giá trị lúc tạo hàm)
  const send = useCallback(() => {
    sendMessage(text);
  }, []);

  // ✅ thêm text vào deps → hàm cập nhật theo text mới nhất
  const sendFixed = useCallback(() => {
    sendMessage(text);
  }, [text]);

  return <input value={text} onChange={(e) => setText(e.target.value)} />;
}
```

> [!NOTE]
> Nếu bạn cần một hàm ổn định **mà vẫn** đọc state mới nhất, hãy cân nhắc `useRef` lưu giá trị, hoặc dùng updater function. React cũng đang chuẩn hoá hook `useEffectEvent` cho nhu cầu này.

---

## 7. Khi nào KHÔNG cần

- Phép tính tầm thường: `useMemo(() => a + b, [a, b])` đắt hơn `a + b`.
- Hàm truyền cho component **không** memo: useCallback vô ích.
- Dự án đã bật **React Compiler**: phần lớn memoization thủ công trở nên thừa.

> [!TIP]
> Mặc định: **viết code không có** useMemo/useCallback. Khi Profiler chỉ ra điểm nóng, mới thêm vào đúng chỗ. "Premature memoization" cũng tệ như premature optimization.

---

## Tài liệu tham khảo

- [React Docs — useMemo](https://react.dev/reference/react/useMemo)
- [React Docs — useCallback](https://react.dev/reference/react/useCallback)
- [React.memo](/toi-uu-rerender/react-memo/)
- [Referential Equality](/toi-uu-rerender/referential-equality/)
