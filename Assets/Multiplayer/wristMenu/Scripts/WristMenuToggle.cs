using UnityEngine;
using UnityEngine.Events;

public class WristMenuToggle : MonoBehaviour
{
    [SerializeField]
    private GameObject menuRoot;

    public UnityEvent OnMenuOpened;
    public UnityEvent OnMenuClosed;

    public bool IsOpen =>
        menuRoot != null &&
        menuRoot.activeSelf;

    public void Toggle()
    {
        if (menuRoot == null)
            return;

        bool open = !menuRoot.activeSelf;

        menuRoot.SetActive(open);

        if (open)
            OnMenuOpened?.Invoke();
        else
            OnMenuClosed?.Invoke();
    }

    public void Show()
    {
        if (menuRoot == null || menuRoot.activeSelf)
            return;

        menuRoot.SetActive(true);

        OnMenuOpened?.Invoke();
    }

    public void Hide()
    {
        if (menuRoot == null || !menuRoot.activeSelf)
            return;

        menuRoot.SetActive(false);

        OnMenuClosed?.Invoke();
    }
}