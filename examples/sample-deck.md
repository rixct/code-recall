# Sample CodeRecall deck

Open this note in Obsidian, then run **"CodeRecall: Review current note"**
(Command palette, or the brain icon in the left ribbon).

Cards use the **`---` format**: `header --- code --- tests`. The code between the
`---` lines is taken *verbatim*, so its indentation (spaces or tabs) is preserved
exactly and never breaks parsing.

The first two cards are JavaScript (offline). Python uses Pyodide (downloads once,
needs internet). C++ uses JSCPP (offline, stdin/stdout tests, no STL).

## Reverse a string (JavaScript)

```coderecall
lang: javascript
name: Reverse a string
---
function reverse(s) {
    return {{c1::s.split("").reverse().join("")}};
}
---
tests:
  - in: '["hello"]'
    out: '"olleh"'
  - in: '["abc"]'
    out: '"cba"'
```

## Two Sum (JavaScript)

```coderecall
lang: javascript
name: Two Sum (JS)
---
function twoSum(nums, target) {
    const seen = {};
    for (let i = 0; i < nums.length; i++) {
        {{c1::const need = target - nums[i];
        if (need in seen) return [seen[need], i];
        seen[nums[i]] = i;}}
    }
}
---
tests:
  - in: "[[2, 7, 11, 15], 9]"
    out: "[0, 1]"
  - in: "[[3, 2, 4], 6]"
    out: "[1, 2]"
```

## Two Sum (Python, via Pyodide)

```coderecall
lang: python
name: Two Sum (Python)
---
def two_sum(nums, target):
    seen = {}
    {{c1::for i, n in enumerate(nums):
        if target - n in seen:
            return [seen[target - n], i]
        seen[n] = i}}
---
tests:
  - in: "[[2, 7, 11, 15], 9]"
    out: "[0, 1]"
  - in: "[[3, 2, 4], 6]"
    out: "[1, 2]"
```

## Sorted unique numbers (C++, full STL)

C++ and Java use **stdin/stdout** tests: `in` is piped to the program, `out` is
compared to what it prints. With **Native execution** on (Settings → CodeRecall),
C++ is compiled with your local **g++/clang++** — full STL works.

```coderecall
lang: c++
name: Sorted unique (C++)
mode: stdio
---
#include <iostream>
#include <set>
using namespace std;
int main() {
    int n;
    cin >> n;
    set<int> s;
    for (int i = 0; i < n; i++) {
        int x;
        cin >> x;
        {{c1::s.insert(x);}}
    }
    for (int x : s) cout << x << " ";
    cout << endl;
    return 0;
}
---
tests:
  - in: "5\n3 1 2 3 1"
    out: "1 2 3"
  - in: "4\n9 9 4 4"
    out: "4 9"
```

## Sum of an array (Java)

Java runs via the JDK's single-file mode (`java Main.java`) — needs a **JDK 11+**
installed and Native execution enabled.

```coderecall
lang: java
name: Sum of an array (Java)
mode: stdio
---
import java.util.*;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        long sum = 0;
        for (int i = 0; i < n; i++) {
            {{c1::sum += sc.nextInt();}}
        }
        System.out.println(sum);
    }
}
---
tests:
  - in: "3\n1 2 3"
    out: "6"
  - in: "5\n10 20 30 40 50"
    out: "150"
```

## Not a card

A normal code block — the parser skips it.

```python
print("just a snippet, not reviewed")
```
