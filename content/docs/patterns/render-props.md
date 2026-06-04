---
title: "Render Props & HOC"
description: "Hai pattern chia sẻ logic thời tiền-hook — cách hoạt động, vì sao custom hook thay thế chúng, và khi nào vẫn cần"
---

# Render Props & HOC

## Mục lục

- [Tổng quan](#tổng-quan)
- [1. Render Props là gì](#1-render-props-là-gì)
- [2. Ví dụ: MouseTracker](#2-ví-dụ-mousetracker)
- [3. Higher-Order Component (HOC)](#3-higher-order-component-hoc)
- [4. Vấn đề: wrapper hell](#4-vấn-đề-wrapper-hell)
- [5. Custom hook thay thế cả hai](#5-custom-hook-thay-thế-cả-hai)
- [6. Khi nào vẫn nên dùng](#6-khi-nào-vẫn-nên-dùng)
- [Tài liệu tham khảo](#tài-liệu-tham-khảo)

---

## Tổng quan

**Render props** và **HOC** (Higher-Order Component) là hai pattern kinh điển để **chia sẻ logic** giữa các component — ra đời **trước** khi có hooks. Hiểu chúng giúp bạn (a) đọc code cũ, (b) nắm vì sao hooks thắng thế, (c) nhận ra vài trường hợp chúng vẫn hữu ích.

> [!IMPORTANT]
> Với code mới, **custom hook** gần như luôn là lựa chọn tốt hơn cả render props lẫn HOC để chia sẻ logic stateful. Nhưng render props vẫn sống khỏe cho việc **chia sẻ JSX/cách render**, và HOC vẫn xuất hiện trong nhiều thư viện.

---

## 1. Render Props là gì

Một component nhận một **hàm** qua prop (thường là `children` hoặc `render`), và **gọi hàm đó** để biết phải render gì — truyền dữ liệu nội bộ vào hàm.

```tsx
// "render prop" = prop có giá trị là một hàm trả về JSX
<DataProvider render={(data) => <h1>{data.title}</h1>} />

// Hoặc dùng children làm hàm:
<DataProvider>{(data) => <h1>{data.title}</h1>}</DataProvider>
```

Component giữ **logic + state**; nơi dùng quyết định **giao diện** từ dữ liệu đó.

---

## 2. Ví dụ: MouseTracker

```tsx
import { useState, ReactNode } from 'react';

function Mouse({ children }: { children: (pos: { x: number; y: number }) => ReactNode }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  return (
    <div
      style={{ height: '100vh' }}
      onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
    >
      {children(pos)} {/* gọi render prop với dữ liệu nội bộ */}
    </div>
  );
}

// Cùng logic "theo dõi chuột", hai cách hiển thị khác nhau:
function App() {
  return (
    <Mouse>
      {({ x, y }) => <p>Chuột ở ({x}, {y})</p>}
    </Mouse>
  );
}
```

`Mouse` không quyết định hiển thị gì — nó đưa toạ độ cho hàm con. Logic theo dõi chuột được tái dùng cho mọi cách render.

---

## 3. Higher-Order Component (HOC)

HOC là một **hàm nhận một component, trả về một component mới** đã "bọc" thêm logic/props. Quy ước tên `with*`.

```tsx
import { ComponentType, useState, useEffect } from 'react';

// HOC tiêm prop "width" vào component được bọc
function withWindowWidth<P>(Wrapped: ComponentType<P & { width: number }>) {
  return function Enhanced(props: P) {
    const [width, setWidth] = useState(window.innerWidth);
    useEffect(() => {
      const onResize = () => setWidth(window.innerWidth);
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }, []);
    return <Wrapped {...props} width={width} />;
  };
}

// Dùng:
function Bar({ width }: { width: number }) {
  return <p>Rộng {width}px</p>;
}
const BarWithWidth = withWindowWidth(Bar);
```

> [!NOTE]
> `connect()` của Redux cũ, `withRouter` của React Router cũ đều là HOC. Bạn vẫn gặp chúng nhiều trong codebase đời trước.

---

## 4. Vấn đề: wrapper hell

Cả render props lồng nhau lẫn HOC chồng nhau đều tạo ra **cây bọc sâu**, khó đọc và khó debug:

```tsx
// Render props lồng — "kim tự tháp tận thế"
<Auth>
  {(user) => (
    <Theme>
      {(theme) => (
        <Data>
          {(data) => <Page user={user} theme={theme} data={data} />}
        </Data>
      )}
    </Theme>
  )}
</Auth>

// HOC chồng — khó biết prop nào từ đâu
export default withAuth(withTheme(withData(withRouter(Page))));
```

```mermaid
graph TD
    A["withAuth"] --> B["withTheme"] --> C["withData"] --> D["withRouter"] --> E["Page thật"]
    note["Mỗi tầng thêm 1 component vào cây<br/>→ DevTools rối, props khó truy nguồn"]
```

---

## 5. Custom hook thay thế cả hai

Hook làm cùng việc (chia sẻ logic stateful) mà **không** thêm tầng vào cây component:

```tsx
// Thay vì withWindowWidth (HOC) hay <Mouse> (render prop):
function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}

// Dùng phẳng, rõ ràng:
function Page() {
  const width = useWindowWidth();
  const user = useAuth();
  const theme = useTheme();
  return <p>{user.name} – {theme} – {width}px</p>;
}
```

| Tiêu chí | Render Props | HOC | Custom Hook |
|----------|-------------|-----|-------------|
| Thêm tầng vào cây | Có | Có | **Không** |
| Truy nguồn dữ liệu | Trung bình | Khó (props "ma") | **Dễ** |
| Trùng tên prop | — | Dễ đụng | Không vấn đề |
| Chia sẻ logic stateful | Được | Được | **Tốt nhất** |
| Chia sẻ cách **render** | **Tốt** | Kém | Không phải việc của nó |

---

## 6. Khi nào vẫn nên dùng

<Accordions type="single">
  <Accordion title="Render props: khi cần chia sẻ CÁCH RENDER">
    Khi component cần để nơi dùng quyết định render gì từ dữ liệu/trạng thái nội bộ — vd &lt;Virtualizer&gt;, &lt;Tooltip&gt; cho phép custom nội dung, list ảo hóa. Hook không truyền JSX ngược lên được.
  </Accordion>
  <Accordion title="HOC: khi bọc cross-cutting cho component bất kỳ">
    Khi cần áp một hành vi lên nhiều component có sẵn mà không sửa từng cái (vd error boundary wrapper, analytics tracking, code cũ của thư viện).
  </Accordion>
  <Accordion title="Mặc định cho logic mới: custom hook">
    Mọi logic stateful tái dùng → viết custom hook trước. Chỉ rơi về render props/HOC khi hook không diễn đạt được nhu cầu.
  </Accordion>
</Accordions>

---

## Tài liệu tham khảo

- [React (legacy) — Render Props](https://legacy.reactjs.org/docs/render-props.html)
- [React (legacy) — Higher-Order Components](https://legacy.reactjs.org/docs/higher-order-components.html)
- [Custom Hooks](/patterns/custom-hooks/)
