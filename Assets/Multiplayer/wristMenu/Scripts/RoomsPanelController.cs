using System.Collections;
using CXR.SDK.Rooms;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

public class RoomsPanelController : RuntimeFacadePanel
{

    [Header("UI")]
    [SerializeField]
    private TMP_Text roomCountText;

    [SerializeField]
    private Transform contentRoot;

    [SerializeField]
    private RoomCardController roomCardPrefab;

    [SerializeField]
    private Button startSearchButton;

    [SerializeField]
    private Button refreshButton;

    [SerializeField]
    private Button stopSearchButton;
    private void Start()
    {
        startSearchButton.onClick
            .AddListener(OnStartSearch);

        refreshButton.onClick
            .AddListener(OnRefresh);

        stopSearchButton.onClick
            .AddListener(OnStopSearch);

        RefreshRoomList();
    }

    private void OnDestroy()
    {
        startSearchButton.onClick
            .RemoveListener(OnStartSearch);

        refreshButton.onClick
            .RemoveListener(OnRefresh);

        stopSearchButton.onClick
            .RemoveListener(OnStopSearch);
    }

    private void OnStartSearch()
    {
        if (runtimeFacade == null)
            return;

        runtimeFacade.StartDiscovery();

        StartCoroutine(
            DelayedRefresh());
    }

    private void OnRefresh()
    {
        if (runtimeFacade == null)
            return;

        runtimeFacade.RefreshRooms();

        StartCoroutine(
            DelayedRefresh());
    }

    private void OnStopSearch()
    {
        if (runtimeFacade == null)
            return;

        runtimeFacade.StopDiscovery();

        RefreshRoomList();
    }

    private IEnumerator DelayedRefresh()
    {
        yield return new WaitForSeconds(0.5f);

        RefreshRoomList();
    }

    private void RefreshRoomList()
    {
        if (runtimeFacade == null)
            return;

        ClearCards();

        var rooms =
            runtimeFacade.VisibleRooms;

        roomCountText.text =
            rooms.Count.ToString();

        foreach (RoomInfo room in rooms)
        {
            RoomCardController card =
                Instantiate(
                    roomCardPrefab,
                    contentRoot);

            card.Initialize(
                room,
                runtimeFacade);
        }
    }

    private void ClearCards()
    {
        for (int i = contentRoot.childCount - 1;
             i >= 0;
             i--)
        {
            Destroy(
                contentRoot.GetChild(i)
                    .gameObject);
        }
    }
}