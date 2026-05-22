using UnityEngine;

public class WristMenuToggle : MonoBehaviour
{
    [SerializeField]
    private GameObject menuRoot;

    public void Toggle()
    {
        menuRoot.SetActive(!menuRoot.activeSelf);
    }
}